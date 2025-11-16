import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let userData = null;
let taskData = null;
let map = null;

// Get task ID from URL
const urlParams = new URLSearchParams(window.location.search);
const taskId = urlParams.get("id");

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "./index.html";
        return;
    }
    
    currentUser = user;
    
    const usernameEl = document.getElementById("username");
    const profileEl = document.getElementById("profile");
    
    if (usernameEl) {
        usernameEl.textContent = user.displayName || user.email;
    }
    
    if (profileEl) {
        profileEl.src = user.photoURL || "";
    }
    
    try {
        userData = await api.getCurrentUser();
        await loadTask();
    } catch (error) {
        console.error("Error loading user data:", error);
    }
});

async function loadTask() {
    if (!taskId) {
        document.getElementById("task-container").innerHTML = "<div class='error'>Task ID not provided</div>";
        return;
    }
    
    try {
        taskData = await api.getTask(taskId);
        displayTask();
        setupActions();
        if (taskData.status === "ongoing" || taskData.status === "pending_confirmation") {
            loadMessages();
            document.getElementById("chat-container").style.display = "block";
        }
    } catch (error) {
        document.getElementById("task-container").innerHTML = `<div class='error'>Error loading task: ${error.message}</div>`;
    }
}

function displayTask() {
    const container = document.getElementById("task-container");
    
    container.innerHTML = `
        <h2>${taskData.title}</h2>
        <div style="margin-bottom: 1rem;">
            <span class="task-status status-${taskData.status}">${taskData.status.replace('_', ' ')}</span>
        </div>
        <p><strong>Description:</strong></p>
        <p>${taskData.description}</p>
        <div style="margin-top: 1.5rem;">
            <p><strong>Payment:</strong> $${taskData.payment.toFixed(2)}</p>
            ${taskData.contact_number ? `<p><strong>Contact:</strong> ${taskData.contact_number}</p>` : ''}
            ${taskData.schedule ? `<p><strong>Schedule:</strong> ${new Date(taskData.schedule).toLocaleString()}</p>` : ''}
            ${taskData.location_address ? `<p><strong>Location:</strong> ${taskData.location_address}</p>` : ''}
        </div>
        <div id="map" style="width: 100%; height: 300px; margin-top: 1rem; border-radius: 6px;"></div>
    `;
    
    // Initialize map after a short delay to ensure DOM is ready
    setTimeout(initMap, 100);
}

function initMap() {
    if (!taskData) return;
    
    const taskLocation = [taskData.location_lat, taskData.location_lng];
    
    // Create map
    map = L.map('map').setView(taskLocation, 15);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Add marker
    L.marker(taskLocation)
        .addTo(map)
        .bindPopup(taskData.title)
        .openPopup();
};

function setupActions() {
    const actionsContainer = document.getElementById("actions-container");
    const actionButtons = document.getElementById("action-buttons");
    
    if (!userData) return;
    
    const isPoster = taskData.poster_id === userData.id;
    const isSeeker = taskData.seeker_id === userData.id;
    
    let buttons = [];
    
    if (taskData.status === "available") {
        if (isPoster) {
            buttons.push(`<button class="btn btn-danger" onclick="cancelTask()">Cancel Task</button>`);
            buttons.push(`<a href="./edit-task.html?id=${taskData.id}" class="btn btn-outline">Edit Task</a>`);
        } else {
            buttons.push(`<button class="btn btn-primary" onclick="acceptTask()">Accept Task</button>`);
        }
    } else if (taskData.status === "ongoing") {
        if (isSeeker) {
            buttons.push(`<button class="btn btn-secondary" onclick="completeTask()">Mark as Complete</button>`);
        }
        if (isPoster || isSeeker) {
            buttons.push(`<button class="btn btn-danger" onclick="cancelTask()">Cancel Task</button>`);
        }
    } else if (taskData.status === "pending_confirmation") {
        if (isPoster) {
            buttons.push(`<button class="btn btn-secondary" onclick="confirmTask()">Confirm Completion</button>`);
        }
    } else if (taskData.status === "completed") {
        if (isPoster && !taskData.feedback) {
            buttons.push(`<button class="btn btn-primary" onclick="showFeedbackForm()">Leave Feedback</button>`);
        }
    }
    
    if (buttons.length > 0) {
        actionButtons.innerHTML = buttons.join(" ");
        actionsContainer.style.display = "block";
    }
}

async function acceptTask() {
    try {
        await api.acceptTask(taskId);
        alert("Task accepted successfully!");
        loadTask();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function completeTask() {
    if (!confirm("Mark this task as complete?")) return;
    
    try {
        await api.completeTask(taskId);
        alert("Task marked as complete! Waiting for poster confirmation.");
        loadTask();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function confirmTask() {
    if (!confirm("Confirm that this task is completed?")) return;
    
    try {
        await api.confirmTask(taskId);
        alert("Task confirmed as completed!");
        loadTask();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function cancelTask() {
    if (!confirm("Are you sure you want to cancel this task?")) return;
    
    try {
        await api.cancelTask(taskId);
        alert("Task cancelled.");
        loadTask();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

function showFeedbackForm() {
    const rating = prompt("Rate the seeker (1-5):");
    if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
        alert("Please enter a valid rating between 1 and 5");
        return;
    }
    
    const comment = prompt("Leave a comment (optional):");
    
    createFeedback(parseInt(rating), comment || null);
}

async function createFeedback(rating, comment) {
    try {
        await api.createFeedback(taskId, taskData.seeker_id, rating, comment);
        alert("Feedback submitted successfully!");
        loadTask();
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function loadMessages() {
    try {
        const messages = await api.getTaskMessages(taskId);
        const messagesContainer = document.getElementById("messages");
        
        messagesContainer.innerHTML = messages.map(msg => {
            const isSent = msg.sender_id === userData.id;
            const time = new Date(msg.created_at).toLocaleTimeString();
            return `
                <div class="message ${isSent ? 'sent' : 'received'}">
                    <div>${msg.content}</div>
                    <div class="message-time">${time}</div>
                </div>
            `;
        }).join('');
        
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    } catch (error) {
        console.error("Error loading messages:", error);
    }
}

// Send message
document.getElementById("send-message-btn").addEventListener("click", async () => {
    const input = document.getElementById("message-input");
    const content = input.value.trim();
    
    if (!content) return;
    
    try {
        await api.sendMessage(taskId, content);
        input.value = "";
        loadMessages();
    } catch (error) {
        alert("Error sending message: " + error.message);
    }
});

// Enter key to send
document.getElementById("message-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        document.getElementById("send-message-btn").click();
    }
});

// Make functions global
window.acceptTask = acceptTask;
window.completeTask = completeTask;
window.confirmTask = confirmTask;
window.cancelTask = cancelTask;
window.showFeedbackForm = showFeedbackForm;

// Logout
const logoutBtn = document.getElementById("google-logout-btn-id");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "./index.html";
        });
    });
}

