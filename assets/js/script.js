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

    // Goals (Static for now)
    const goals = {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 70
    };

    const perimeter = 339.292; // 2 * pi * 54

    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

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

        if (currentFoodItem.calories > 0) {
            const ratio = calories / currentFoodItem.calories;
            addNutrients({
                calories: calories,
                protein: currentFoodItem.protein * ratio,
                carbs: currentFoodItem.carbs * ratio,
                fat: currentFoodItem.fat * ratio
            });
        } else {
            // Fallback for custom food with no API data
            addNutrients({
                calories: calories,
                protein: 0,
                carbs: 0,
                fat: 0
            });
        }

        // UI Update: Add item to list
        const list = document.getElementById(`list-${currentMeal}`);
        const li = document.createElement('li');
        li.className = 'food-item';
        li.innerHTML = `<span>${foodName}</span> <span>${calories} kcal</span>`;
        list.appendChild(li);

        // Reset & Close
        calInput.value = '';
        foodSearchInput.value = '';
        currentFoodItem = { name: '', calories: 0, protein: 0, carbs: 0, fat: 0 }; // Reset state
        modal.style.display = 'none';
    };

    document.querySelectorAll('.tag').forEach(tag => {
        tag.onclick = () => {
            const food = tag.innerText;
            foodSearchInput.value = food;
            fetchFoodData(food);
        };
    });

    function addNutrients(nutrients) {
        dailyNutrients.calories += nutrients.calories;
        dailyNutrients.protein += nutrients.protein;
        dailyNutrients.carbs += nutrients.carbs;
        dailyNutrients.fat += nutrients.fat;

        updateDashboard();
    }

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
        }
    };

    resetWaterBtn.onclick = () => {
        waterGlasses = 0;
        updateWaterUI();
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
});
