// script.js

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('addFoodModal');
    const modalTitle = document.getElementById('modalTitle');
    const closeBtn = document.querySelector('.close-modal');
    const saveBtn = document.getElementById('saveFoodBtn');
    const foodSearchInput = document.getElementById('foodSearch');
    const calInput = document.getElementById('calInput');

    // New: Search Results container (dynamically created if not present, though we added it in HTML)
    const searchResults = document.getElementById('searchResults');

    // State
    let currentMeal = null;
    let debounceTimer;
    let currentFoodItem = {
        name: '',
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    // Daily Totals State
    let dailyNutrients = {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
    };

    // New: Track meals for persistence
    let todayMeals = {
        Breakfast: [],
        Lunch: [],
        Dinner: [],
        Snacks: []
    };

    // Goals (Static for now)
    const goals = {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 70
    };

    const perimeter = 339.292; // 2 * pi * 54

    // --- Helper: Robust Date Key (YYYY-MM-DD) ---
    function getDatestamp(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // Initialize
    const todayKey = getDatestamp();
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

    try {
        loadData();
    } catch (err) {
        console.error("Data Load Error:", err);
        // Fallback: Clear potentially corrupted data if it causes crash
        // localStorage.removeItem('nutriTrack_history'); 
        // For now just log, to avoid deleting user data if it's just a minor bug.
    }

    window.openFoodModal = (meal) => {
        currentMeal = meal;
        modalTitle.innerText = `Add to ${meal}`;
        modal.style.display = 'flex';
        foodSearchInput.value = '';
        calInput.value = '';
        searchResults.style.display = 'none'; // Hide results
        foodSearchInput.focus();
    };

    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };

    // Hide results on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-bar')) {
            searchResults.style.display = 'none';
        }
    });

    // API Search Logic
    foodSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(debounceTimer);

        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchFoodData(query);
        }, 500);
    });

    async function fetchFoodData(query) {
        try {
            // Show loading state
            searchResults.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Searching...</div>';
            searchResults.style.display = 'block';

            // Fetch optimized results (limit fields)
            const fields = 'product_name,nutriments,_id';
            const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=5&fields=${fields}`);

            if (!res.ok) throw new Error('Network response was not ok');

            const data = await res.json();

            searchResults.innerHTML = '';

            if (data.products && data.products.length > 0) {
                data.products.forEach(product => {
                    const div = document.createElement('div');
                    div.className = 'search-result-item';
                    const name = product.product_name || 'Unknown Product';
                    const cals = product.nutriments['energy-kcal_100g'] || product.nutriments.energy_100g || 0;

                    div.innerHTML = `<div><strong>${name}</strong></div><div>${Math.round(cals)} kcal/100g</div>`;

                    div.onclick = () => selectFoodItem(product);
                    searchResults.appendChild(div);
                });
                searchResults.style.display = 'block';
            } else {
                searchResults.innerHTML = '<div class="loading">No results found</div>';
                setTimeout(() => searchResults.style.display = 'none', 2000);
            }
        } catch (err) {
            console.error("Failed to fetch food data", err);
            searchResults.innerHTML = '<div class="loading">Error fetching data</div>';
        }
    }

    function selectFoodItem(product) {
        const nutriments = product.nutriments;

        currentFoodItem = {
            name: product.product_name || 'Unknown Food',
            calories: parseNutrient(nutriments['energy-kcal_100g']) || parseNutrient(nutriments.energy_100g) || 0,
            protein: parseNutrient(nutriments.proteins_100g) || parseNutrient(nutriments.proteins) || 0,
            carbs: parseNutrient(nutriments.carbohydrates_100g) || parseNutrient(nutriments.carbohydrates) || 0,
            fat: parseNutrient(nutriments.fat_100g) || parseNutrient(nutriments.fat) || parseNutrient(nutriments['saturated-fat_100g']) || 0
        };

        foodSearchInput.value = currentFoodItem.name;
        calInput.value = Math.round(currentFoodItem.calories);
        searchResults.style.display = 'none';
    }

    // Add Food interaction
    saveBtn.onclick = () => {
        const calories = parseInt(calInput.value) || 0;
        const foodName = foodSearchInput.value || 'Custom Food';

        if (calories <= 0) return alert('Please enter valid calories');

        let ratio = 0;
        if (currentFoodItem.calories > 0) {
            ratio = calories / currentFoodItem.calories;
        }

        const nutAdded = {
            calories: calories,
            protein: currentFoodItem.protein * ratio,
            carbs: currentFoodItem.carbs * ratio,
            fat: currentFoodItem.fat * ratio
        };

        if (currentFoodItem.calories <= 0) {
            nutAdded.protein = 0;
            nutAdded.carbs = 0;
            nutAdded.fat = 0;
        }

        // Add to State
        const newItem = {
            id: Date.now().toString(), // unique ID
            name: foodName,
            ...nutAdded
        };

        if (!todayMeals[currentMeal]) todayMeals[currentMeal] = [];
        todayMeals[currentMeal].push(newItem);

        // Update Totals
        Object.keys(nutAdded).forEach(k => dailyNutrients[k] += nutAdded[k]);

        // Save & Render
        saveData();
        renderMealItem(currentMeal, newItem);
        updateDashboard();

        // Reset & Close
        calInput.value = '';
        foodSearchInput.value = '';
        currentFoodItem = { name: '', calories: 0, protein: 0, carbs: 0, fat: 0 }; // Reset state
        modal.style.display = 'none';
    };

    function renderMealItem(mealName, item) {
        const list = document.getElementById(`list-${mealName}`);
        const li = document.createElement('li');
        li.className = 'food-item';
        li.id = item.id;

        li.innerHTML = `
            <div class="food-info">
                <span>${item.name}</span>
                <small>${Math.round(item.calories)} kcal</small>
            </div>
            <div class="item-actions">
                <button class="action-btn delete-btn" title="Delete"><i class="fas fa-trash"></i></button>
            </div>
        `;

        // Note: Edit is a bit complex with ID persistence, so keeping it simple: Delete & Re-add.
        // If we want edit, we need to update the array. For now supporting delete is good.
        li.querySelector('.delete-btn').onclick = () => deleteFoodItem(mealName, item.id, li);

        list.appendChild(li);
    }

    function deleteFoodItem(mealName, itemId, liElement) {
        if (!confirm('Delete this item?')) return;

        // Find and remove from state
        const idx = todayMeals[mealName].findIndex(x => x.id === itemId);
        if (idx === -1) return;

        const item = todayMeals[mealName][idx];

        // Subtract totals
        dailyNutrients.calories -= item.calories;
        dailyNutrients.protein -= item.protein;
        dailyNutrients.carbs -= item.carbs;
        dailyNutrients.fat -= item.fat;

        // Remove from array
        todayMeals[mealName].splice(idx, 1);

        saveData();
        updateDashboard();
        liElement.remove();
    }

    document.querySelectorAll('.tag').forEach(tag => {
        tag.onclick = () => {
            const food = tag.innerText;
            foodSearchInput.value = food;
            fetchFoodData(food);
        };
    });

    function updateDashboard() {
        // Update Calories
        document.getElementById('calConsumed').innerText = Math.round(dailyNutrients.calories);
        document.getElementById('calRemaining').innerText = Math.max(0, goals.calories - Math.round(dailyNutrients.calories));

        // Update Ring
        const percent = Math.min(dailyNutrients.calories / goals.calories, 1);
        const offset = perimeter - (perimeter * percent);
        document.querySelector('.ring-progress').style.strokeDashoffset = offset;

        // Update Macro Rings
        const miniPerimeter = 188.5; // 2 * pi * 30

        const pPercent = Math.min((dailyNutrients.protein / goals.protein), 1);
        const cPercent = Math.min((dailyNutrients.carbs / goals.carbs), 1);
        const fPercent = Math.min((dailyNutrients.fat / goals.fat), 1);

        document.getElementById('protRing').style.strokeDashoffset = miniPerimeter - (miniPerimeter * pPercent);
        document.getElementById('carbRing').style.strokeDashoffset = miniPerimeter - (miniPerimeter * cPercent);
        document.getElementById('fatRing').style.strokeDashoffset = miniPerimeter - (miniPerimeter * fPercent);

        document.getElementById('protValDisplay').innerText = `${Math.round(dailyNutrients.protein)}g`;
        document.getElementById('carbValDisplay').innerText = `${Math.round(dailyNutrients.carbs)}g`;
        document.getElementById('fatValDisplay').innerText = `${Math.round(dailyNutrients.fat)}g`;
    }

    // --- Persistence ---
    function saveData() {
        const fullHistory = JSON.parse(localStorage.getItem('nutriTrack_history')) || {};

        fullHistory[todayKey] = {
            nutrients: dailyNutrients,
            meals: todayMeals,
            water: waterGlasses
        };

        localStorage.setItem('nutriTrack_history', JSON.stringify(fullHistory));
    }

    function loadData() {
        const fullHistory = JSON.parse(localStorage.getItem('nutriTrack_history')) || {};
        const todayData = fullHistory[todayKey];

        if (todayData) {
            dailyNutrients = todayData.nutrients || dailyNutrients;
            todayMeals = todayData.meals || todayMeals;
            waterGlasses = todayData.water || 0;

            // Render UI
            updateDashboard();
            updateWaterUI();

            // Re-render lists
            Object.keys(todayMeals).forEach(mealName => {
                const items = todayMeals[mealName];
                items.forEach(item => renderMealItem(mealName, item));
            });
        }
    }

    // Water Logic
    let waterGlasses = 0;
    const waterGoal = 8;
    const addWaterBtn = document.getElementById('addWaterBtn');
    const resetWaterBtn = document.getElementById('resetWaterBtn');
    const waterFill = document.getElementById('waterFill');
    const waterCount = document.getElementById('waterCount');

    addWaterBtn.onclick = () => {
        if (waterGlasses < waterGoal) {
            waterGlasses++;
            updateWaterUI();
            saveData();
        }
    };

    resetWaterBtn.onclick = () => {
        waterGlasses = 0;
        updateWaterUI();
        saveData();
    };

    function updateWaterUI() {
        waterCount.innerText = waterGlasses;
        const percent = (waterGlasses / waterGoal) * 100;
        waterFill.style.height = `${percent}%`;

        if (waterGlasses > 0) {
            resetWaterBtn.style.display = 'block';
        } else {
            resetWaterBtn.style.display = 'none';
        }

        if (waterGlasses === waterGoal) {
            addWaterBtn.disabled = true;
            addWaterBtn.innerText = 'Goal Reached!';
            addWaterBtn.style.background = '#10b981';
        } else {
            addWaterBtn.disabled = false;
            addWaterBtn.innerHTML = '<i class="fas fa-plus"></i> Drink';
            addWaterBtn.style.background = '#3b82f6';
        }
    }

    // Helper to safely parse API numbers (handles " < 0.1 ", strings etc)
    function parseNutrient(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        // Remove non-numeric chars except dot
        const clean = String(val).replace(/[^0-9.]/g, '');
        return parseFloat(clean) || 0;
    }

    // --- Navigation & Views ---
    const navDashboard = document.getElementById('nav-dashboard');
    const navMeals = document.getElementById('nav-meals');
    const navReports = document.getElementById('nav-reports');
    const navSettings = document.getElementById('nav-settings');

    const dashboardView = document.getElementById('dashboard-view');
    const mealsView = document.getElementById('meals-view');
    const reportsView = document.getElementById('reports-view');
    const settingsView = document.getElementById('settings-view');

    function hideAllViews() {
        dashboardView.style.display = 'none';
        if (mealsView) mealsView.style.display = 'none';
        reportsView.style.display = 'none';
        if (settingsView) settingsView.style.display = 'none';

        navDashboard.classList.remove('active');
        if (navMeals) navMeals.classList.remove('active');
        navReports.classList.remove('active');
        if (navSettings) navSettings.classList.remove('active');
    }

    function switchView(viewName) {
        hideAllViews();
        if (viewName === 'dashboard') {
            dashboardView.style.display = 'block';
            navDashboard.classList.add('active');
        } else if (viewName === 'meals') {
            if (mealsView) mealsView.style.display = 'block';
            if (navMeals) navMeals.classList.add('active');
        } else if (viewName === 'reports') {
            reportsView.style.display = 'block';
            navReports.classList.add('active');
            renderReports();
        } else if (viewName === 'settings') {
            if (settingsView) settingsView.style.display = 'block';
            if (navSettings) navSettings.classList.add('active');
        }
    }

    navDashboard.onclick = (e) => { e.preventDefault(); switchView('dashboard'); };
    if (navMeals) navMeals.onclick = (e) => { e.preventDefault(); switchView('meals'); };
    navReports.onclick = (e) => { e.preventDefault(); switchView('reports'); };
    if (navSettings) navSettings.onclick = (e) => { e.preventDefault(); switchView('settings'); };

    function renderReports() {
        // Page Under Construction
    }



});
