import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "./index.html";
        return;
    }
    
    const usernameEl = document.getElementById("username");
    const profileEl = document.getElementById("profile");
    
    if (usernameEl) {
        usernameEl.textContent = user.displayName || user.email;
    }
    
    if (profileEl) {
        profileEl.src = user.photoURL || "";
    }
    
    await loadTasks();
});

async function loadTasks() {
    const container = document.getElementById("tasks-container");
    
    try {
        const tasks = await api.getTasks("available");
        
        if (tasks.length === 0) {
            container.innerHTML = "<p class='loading'>No available tasks at the moment. Check back later!</p>";
            return;
        }
        
        container.innerHTML = tasks.map(task => `
            <div class="task-card" onclick="window.location.href='./task-detail.html?id=${task.id}'">
                <h3>${task.title}</h3>
                <p>${task.description.substring(0, 150)}${task.description.length > 150 ? '...' : ''}</p>
                <div class="task-meta">
                    <span class="task-status status-${task.status}">${task.status}</span>
                    <span><strong>$${task.payment.toFixed(2)}</strong></span>
                </div>
                ${task.location_address ? `<p style="margin-top: 0.5rem; color: var(--text-secondary); font-size: 0.875rem;">📍 ${task.location_address}</p>` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error("Error loading tasks:", error);
        container.innerHTML = `<div class="error">Error loading tasks: ${error.message}</div>`;
    }
}

// Logout
const logoutBtn = document.getElementById("google-logout-btn-id");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "./index.html";
        });
    });
}

