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

    // State Management
    let currentMeal = null; // Currently selected meal type for adding food
    let debounceTimer; // Timer for search input debounce
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

    // New: Global History for JSON persistence
    let globalHistory = {};

    // Goals (Mutable)
    let goals = {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 70
    };
    let waterGoal = 8;

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

    loadData().catch(err => {
        console.error("Data Load Error:", err);
    });

    window.openFoodModal = (meal) => {
        currentMeal = meal;
        modalTitle.innerText = `Add to ${meal}`;
        modal.style.display = 'flex';
        foodSearchInput.value = '';
        calInput.value = '';
        searchResults.style.display = 'none'; // Hide results
        foodSearchInput.focus();
    };

    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
        searchResults.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
            searchResults.style.display = 'none';
        }
    });

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
        const delBtn = li.querySelector('.delete-btn');
        delBtn.addEventListener('click', () => deleteFoodItem(mealName, item.id, li));

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
        document.getElementById('goalCalDisplay').innerText = goals.calories;

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
    async function saveData() {
        // 1. Update Settings
        if (globalHistory.settings) {
            globalHistory.settings = {
                calorieGoal: goals.calories,
                waterGoal: waterGoal
            };
        } else {
            globalHistory.settings = {
                calorieGoal: goals.calories,
                waterGoal: waterGoal
            };
        }

        // 2. Update Daily Progress
        globalHistory[todayKey] = {
            nutrients: dailyNutrients,
            meals: todayMeals,
            water: waterGlasses
        };

        try {
            await fetch('data.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(globalHistory)
            });
        } catch (err) {
            console.error("Failed to save data:", err);
        }
    }

    async function loadData() {
        try {
            // Add timestamp to prevent caching
            const res = await fetch(`data.php?t=${Date.now()}`);
            if (!res.ok) throw new Error('Failed to load data');

            globalHistory = await res.json();

            // Load Settings
            if (globalHistory.settings) {
                if (globalHistory.settings.calorieGoal) goals.calories = globalHistory.settings.calorieGoal;
                if (globalHistory.settings.waterGoal) waterGoal = globalHistory.settings.waterGoal;
            }

            const todayData = globalHistory[todayKey];

            if (todayData) {
                dailyNutrients = todayData.nutrients || dailyNutrients;
                todayMeals = todayData.meals || todayMeals;
                waterGlasses = todayData.water || 0;

                // Re-render lists
                Object.keys(todayMeals).forEach(mealName => {
                    const items = todayMeals[mealName];
                    items.forEach(item => renderMealItem(mealName, item));
                });
            }

            // Always update UI (even if no data, to show correct Goals)
            updateDashboard();
            updateWaterUI();

        } catch (err) {
            console.error("Error loading data from server:", err);
            // Optionally initialize empty history if file is missing/corrupt
            globalHistory = {};
            // Still render UI defaults
            updateDashboard();
        }
    }

    // Water Logic
    let waterGlasses = 0;
    // waterGoal is now global
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
        document.getElementById('goalWaterDisplay').innerText = waterGoal;
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
            renderMealsView();
        } else if (viewName === 'reports') {
            reportsView.style.display = 'block';
            navReports.classList.add('active');
            renderReports();
        } else if (viewName === 'settings') {
            if (settingsView) settingsView.style.display = 'block';
            if (navSettings) navSettings.classList.add('active');
            renderSettingsView();
        }
    }

    navDashboard.onclick = (e) => { e.preventDefault(); switchView('dashboard'); };
    if (navMeals) navMeals.onclick = (e) => { e.preventDefault(); switchView('meals'); };
    navReports.onclick = (e) => { e.preventDefault(); switchView('reports'); };
    if (navSettings) navSettings.onclick = (e) => { e.preventDefault(); switchView('settings'); };

    function renderReports() {
        // Page Under Construction
    }

    // --- Meals View Logic ---
    function renderMealsView() {
        const tbody = document.getElementById('mealsTableBody');
        const emptyMsg = document.getElementById('no-meals-msg');
        const tableResponsive = document.querySelector('.table-responsive');

        tbody.innerHTML = '';
        let hasData = false;

        // Sort dates descending
        const dates = Object.keys(globalHistory).sort((a, b) => new Date(b) - new Date(a));

        dates.forEach(date => {
            const dayData = globalHistory[date];
            if (!dayData || !dayData.meals) return;

            // Check if day has any meals
            let dayHasMeals = false;
            ['Breakfast', 'Lunch', 'Dinner', 'Snacks'].forEach(m => {
                if (dayData.meals[m] && dayData.meals[m].length > 0) dayHasMeals = true;
            });

            if (!dayHasMeals) return;
            hasData = true;

            // 1. Date Header Row
            const dateRow = document.createElement('tr');
            dateRow.className = 'date-header';
            const formattedDate = new Date(date).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            dateRow.innerHTML = `
                <td colspan="4">
                    <i class="far fa-calendar-alt"></i> ${formattedDate}
                </td>
            `;
            tbody.appendChild(dateRow);

            // 2. Meal Sections
            ['Breakfast', 'Lunch', 'Dinner', 'Snacks'].forEach(mealType => {
                const items = dayData.meals[mealType] || [];
                if (items.length === 0) return;

                // Meal Subheader
                const mealHeader = document.createElement('tr');
                mealHeader.className = `meal-subheader ${mealType}`;
                let icon = 'fa-utensils';
                if (mealType === 'Breakfast') icon = 'fa-coffee';
                if (mealType === 'Lunch') icon = 'fa-hamburger';
                if (mealType === 'Dinner') icon = 'fa-moon';
                if (mealType === 'Snacks') icon = 'fa-cookie-bite';

                mealHeader.innerHTML = `
                    <td colspan="4">
                        <i class="fas ${icon}"></i> ${mealType}
                    </td>
                `;
                tbody.appendChild(mealHeader);

                // Items
                items.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.className = 'item-row';

                    tr.innerHTML = `
                        <td><span class="strong-text">${item.name}</span></td>
                        <td>
                            <div class="detail-text">
                                <span class="macro-tag p">P: ${Math.round(item.protein)}g</span>
                                <span class="macro-tag c">C: ${Math.round(item.carbs)}g</span>
                                <span class="macro-tag f">F: ${Math.round(item.fat)}g</span>
                            </div>
                        </td>
                        <td><span class="cal-text">${Math.round(item.calories)}</span></td>
                        <td style="text-align: right;">
                             <button class="action-btn delete-btn" data-date="${date}" data-meal-type="${mealType}" data-id="${item.id}">
                                <i class="fas fa-trash"></i>
                             </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            });
        });

        if (hasData) {
            tableResponsive.style.display = 'block';
            emptyMsg.style.display = 'none';
        } else {
            tableResponsive.style.display = 'none';
            emptyMsg.style.display = 'flex';
        }
    }

    // Event Delegation for Delete Button in Meals Table
    document.getElementById('mealsTableBody').addEventListener('click', (e) => {
        const btn = e.target.closest('.delete-btn');
        if (!btn) return;

        const date = btn.getAttribute('data-date');
        const mealType = btn.getAttribute('data-meal-type');
        const itemId = btn.getAttribute('data-id');

        if (date && mealType && itemId) {
            deleteMealFromHistory(date, mealType, itemId);
        }
    });

    async function deleteMealFromHistory(date, mealType, itemId) {
        if (!confirm('Permanently delete this item?')) return;

        // 1. Remove from globalHistory
        const dayData = globalHistory[date];
        if (!dayData || !dayData.meals || !dayData.meals[mealType]) return;

        const idx = dayData.meals[mealType].findIndex(x => x.id === itemId);
        if (idx === -1) return;

        // If deleting from TODAY, we must also update current state (dailyNutrients)
        if (date === todayKey) {
            const item = dayData.meals[mealType][idx];
            dailyNutrients.calories -= item.calories;
            dailyNutrients.protein -= item.protein;
            dailyNutrients.carbs -= item.carbs;
            dailyNutrients.fat -= item.fat;

            // Update local todayMeals reference too if needed, though globalHistory is source of truth for save
            const localIdx = todayMeals[mealType].findIndex(x => x.id === itemId);
            if (localIdx !== -1) todayMeals[mealType].splice(localIdx, 1);

            updateDashboard();
        }

        // Remove from Array
        dayData.meals[mealType].splice(idx, 1);

        // 2. Save
        await saveData();

        // 3. Re-render
        renderMealsView();
    }




    // --- Settings View Logic ---
    function renderSettingsView() {
        document.getElementById('settingCalGoal').value = goals.calories;
        document.getElementById('settingWaterGoal').value = waterGoal;
    }

    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.onclick = async () => {
            const newCal = parseInt(document.getElementById('settingCalGoal').value);
            const newWater = parseInt(document.getElementById('settingWaterGoal').value);

            if (newCal > 0) goals.calories = newCal;
            if (newWater > 0) waterGoal = newWater;

            // Recalculate derived macros (simplified ratio)
            // Assuming 30% Protein, 40% Carbs, 30% Fat roughly or keep fixed ratio
            // For now, let's scale macros based on new calories vs 2000 base
            const ratio = goals.calories / 2000;
            goals.protein = Math.round(150 * ratio);
            goals.carbs = Math.round(200 * ratio);
            goals.fat = Math.round(70 * ratio);

            await saveData();
            updateDashboard();
            updateWaterUI();
            alert('Settings Saved!');
        };
    }

    const resetDataBtn = document.getElementById('resetDataBtn');
    if (resetDataBtn) {
        resetDataBtn.onclick = async () => {
            if (confirm('WARNING: This will delete ALL your history. Are you sure?')) {
                // Reset all in-memory state
                globalHistory = {};
                dailyNutrients = { calories: 0, protein: 0, carbs: 0, fat: 0 };
                todayMeals = { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] };
                waterGlasses = 0;
                goals = { calories: 2000, protein: 150, carbs: 200, fat: 70 };
                waterGoal = 8;

                // Save the clean state
                await saveData();
                location.reload();
            }
        };
    }

});
