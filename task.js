// ==========================================
// PANDYA EMPIRE - TASK BOARD
// task.js
// ==========================================

// ---------------- COINS & PEARLS ----------------

// Shared wallet (wallet.js) — the SAME coins & pearls the whole game uses
// (map, battles, tasks). Whatever the player earned in battle shows here.
function walletBalance(){
    return window.PandyaWallet ? PandyaWallet.get() : { coins: 100, pearls: 50 };
}

let coins = walletBalance().coins;
let pearls = walletBalance().pearls;

// Default Unlock (Task 1 Only)
let unlockedTask = Number(localStorage.getItem("pandyaUnlockedTask")) || 1;

// Load Data
window.onload = function () {
    updateStats();
    updateTasks();
};

window.addEventListener('pandya-wallet-change', updateStats);
window.addEventListener('storage', (event) => {
    if (!event.key || event.key === 'pandya.wallet') updateStats();
});

// ---------------- UPDATE TOP STATUS ----------------

function updateStats() {

    const balance = walletBalance();
    coins = balance.coins;
    pearls = balance.pearls;

    document.getElementById("coins").innerText = coins;
    document.getElementById("pearls").innerText = pearls;

}

// ---------------- UPDATE LOCK / UNLOCK ----------------

function updateTasks() {

    const cards = document.querySelectorAll(".task-card");

    cards.forEach((card, index) => {

        const taskNumber = index + 1;
        const lock = card.querySelector(".lock-circle");

        if (taskNumber <= unlockedTask) {

            // Unlock Current Task
            lock.style.display = "none";
            card.classList.add("unlocked");

        } else {

            // Lock Remaining Tasks
            lock.style.display = "flex";
            card.classList.remove("unlocked");

        }

    });

}

// ---------------- OPEN TASK PAGE ----------------

function openTask(taskNumber) {

    if (taskNumber > unlockedTask) {

        alert("🔒 Complete the previous task first!");
        return;

    }

    // Only Tasks 1 and 2 have mission pages so far. Sending the player to a
    // page that does not exist drops them on a dead 404 with no way back, so
    // the tasks that are not built yet stay on the board with a message.
    const taskPages = {
        1: "task1.html",
        2: "task2.html"
    };

    const page = taskPages[taskNumber];

    if (!page) {

        alert("🚧 Task " + taskNumber + " is not open yet.\nMore missions are coming soon!");
        return;

    }

    window.location.href = page;

}

// ---------------- COMPLETE TASK ----------------
// Call completeTask(taskNumber) after finishing a mission.
// Completing a mission SPENDS the mission cost from the shared wallet —
// coins & pearls go DOWN, they are never refunded or awarded.

function completeTask(taskNumber){

    // Cost of each mission (taken out of the shared wallet)
    const costs = {
        1: { coins: 5000, pearls: 100 },
        2: { coins: 6000, pearls: 100 },
        3: { coins: 7500, pearls: 150 },
        4: { coins: 8000, pearls: 200 },
        5: { coins: 9500, pearls: 250 },
        6: { coins: 10000, pearls: 300 }
    };

    const cost = costs[taskNumber] || { coins: 0, pearls: 0 };

    // Decrement — never below 0. PandyaWallet.set() clamps, PandyaWallet.add()
    // does not, so the balance is clamped here and written with set().
    coins = Math.max(0, coins - cost.coins);
    pearls = Math.max(0, pearls - cost.pearls);

    if (window.PandyaWallet) {
        const updated = PandyaWallet.set({ coins, pearls });
        coins = updated.coins;
        pearls = updated.pearls;
    }

    // Unlock Next Task
    if (taskNumber === unlockedTask && taskNumber < 6) {

        unlockedTask++;
        localStorage.setItem("pandyaUnlockedTask", unlockedTask);

    }

    alert("🏆 Task " + taskNumber + " Completed!\n🪙 " + cost.coins + " Coins and ⚪ " + cost.pearls + " Pearls spent.\n✨ Next Task Unlocked!");

    // Back to Task Board
    window.location.href = "task.html";

}

// ---------------- RESET TASK BOARD ----------------
// Type resetTasks() in browser console if needed.

function resetTasks(){

    unlockedTask = 1;

    if (window.PandyaWallet) {
        const fresh = PandyaWallet.reset();
        coins = fresh.coins;
        pearls = fresh.pearls;
    } else {
        coins = 100;
        pearls = 50;
    }

    localStorage.setItem("pandyaUnlockedTask", unlockedTask);

    updateStats();
    updateTasks();

    alert("🔄 Task Board Reset Successfully!");

}