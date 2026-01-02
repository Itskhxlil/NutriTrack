// script.js

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('addFoodModal');
    const modalTitle = document.getElementById('modalTitle');
    const closeBtn = document.querySelector('.close-modal');
    const saveBtn = document.getElementById('saveFoodBtn');
    let currentMeal = null;


    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });


    window.openFoodModal = (meal) => {
        currentMeal = meal;
        modalTitle.innerText = `Add to ${meal}`;
        modal.style.display = 'flex';
    };


    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };

    // Add Food interaction
    saveBtn.onclick = () => {
        const calInput = document.getElementById('calInput').value;
        const foodName = document.getElementById('foodSearch').value || 'Custom Food';

        if (!calInput) return alert('Please enter calories');

        // Add visual item to list
        const list = document.getElementById(`list-${currentMeal}`);
        const li = document.createElement('li');
        li.className = 'food-item';
        li.innerHTML = `<span>${foodName}</span> <span>${calInput} kcal</span>`;
        list.appendChild(li);

        // Progress Update
        updateProgress(parseInt(calInput));

        // Reset & Close
        document.getElementById('calInput').value = '';
        document.getElementById('foodSearch').value = '';
        modal.style.display = 'none';
    };


    document.querySelectorAll('.tag').forEach(tag => {
        tag.onclick = () => {
            document.getElementById('foodSearch').value = tag.innerText;
            // Random calories for demo
            document.getElementById('calInput').value = Math.floor(Math.random() * 300) + 50;
        };
    });

    let consumed = 0;
    const goal = 2000;
    const perimeter = 339.292; // 2 * pi * 54

    function updateProgress(calories) {
        consumed += calories;
        document.getElementById('calConsumed').innerText = consumed;
        document.getElementById('calRemaining').innerText = Math.max(0, goal - consumed);

        // Ring Animation
        const percent = Math.min(consumed / goal, 1);
        const offset = perimeter - (perimeter * percent);
        document.querySelector('.ring-progress').style.strokeDashoffset = offset;

        // Macro Update
        document.querySelector('.fill.prot').style.width = Math.min(percent * 80, 100) + '%';
        document.querySelector('.fill.carb').style.width = Math.min(percent * 90, 100) + '%';
        document.querySelector('.fill.fat').style.width = Math.min(percent * 50, 100) + '%';
    }
});
