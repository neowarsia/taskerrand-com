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
let seekerFeedbackList = null;

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
        seekerFeedbackList = null;
        displayTask();
        setupActions();
        displayFeedbackSection();
        if (taskData.status === "ongoing" || taskData.status === "pending_confirmation") {
            loadMessages();
            document.getElementById("chat-container").style.display = "block";
        }
        if (taskData.status === "completed" && taskData.seeker_id) {
            await loadSeekerRating(taskData.seeker_id);
        }
    } catch (error) {
        document.getElementById("task-container").innerHTML = `<div class='error'>Error loading task: ${error.message}</div>`;
    }
}

function displayTask() {
    const container = document.getElementById("task-container");
    
    container.innerHTML = `
        <h2>Title: ${taskData.title}</h2>
        <div style="margin-bottom: 1rem;">
            <span class="task-status status-${taskData.status}">Status: ${taskData.status.replace('_', ' ')}</span>
        </div>
        <p><strong>Description:</strong></p>
        <p>${taskData.description}</p>
        <div style="margin-top: 1.5rem;">
            <p><strong>Payment:</strong> ₱${taskData.payment.toFixed(2)}</p>
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
            //buttons.push(`<a href="./edit-task.html?id=${taskData.id}" class="btn btn-outline">Edit Task</a>`);
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

async function loadSeekerRating(seekerId) {
    try {
        seekerFeedbackList = await api.getUserFeedback(seekerId);
    } catch (error) {
        console.error("Error loading seeker feedback:", error);
        seekerFeedbackList = [];
    } finally {
        displayFeedbackSection();
    }
}

function displayFeedbackSection() {
    const feedbackContainer = document.getElementById("feedback-container");
    const feedbackContent = document.getElementById("feedback-content");
    const ratingSummary = document.getElementById("seeker-rating-summary");

    if (!feedbackContainer) {
        return;
    }

    if (!taskData || taskData.status !== "completed") {
        feedbackContainer.style.display = "none";
        return;
    }

    feedbackContainer.style.display = "block";

    if (taskData.feedback) {
        const { rating, comment, created_at } = taskData.feedback;
        feedbackContent.innerHTML = `
            <div class="task-card" style="margin-bottom: 1rem;">
                <p><strong>Task Feedback</strong></p>
                <p class="task-status" style="margin: 0.5rem 0;">${renderStars(rating)} (${rating}/5)</p>
                ${comment ? `<p>"${comment}"</p>` : "<p>No written comment.</p>"}
                <p class="message-time">Submitted ${new Date(created_at).toLocaleString()}</p>
            </div>
        `;
    } else {
        feedbackContent.innerHTML = "<p>No feedback has been submitted yet.</p>";
    }

    if (!taskData.seeker_id) {
        ratingSummary.innerHTML = "";
        return;
    }

    if (seekerFeedbackList === null) {
        ratingSummary.innerHTML = "<p>Loading seeker rating...</p>";
        return;
    }

    if (seekerFeedbackList.length === 0) {
        ratingSummary.innerHTML = "<p>The seeker has not received any ratings yet.</p>";
        return;
    }

    const total = seekerFeedbackList.reduce((sum, item) => sum + item.rating, 0);
    const averageRaw = total / seekerFeedbackList.length;
    const average = averageRaw.toFixed(1);

    ratingSummary.innerHTML = `
        <p><strong>Seeker Score:</strong> ${renderStars(Math.round(averageRaw))} ${average}/5</p>
        <p>${seekerFeedbackList.length} review${seekerFeedbackList.length > 1 ? "s" : ""} in total.</p>
    `;
}

function renderStars(score) {
    const clamped = Math.max(0, Math.min(5, score));
    const fullStars = "★".repeat(clamped);
    const emptyStars = "☆".repeat(5 - clamped);
    return `<span class="rating-stars" style="color: #f5b301; letter-spacing: 2px;">${fullStars}${emptyStars}</span>`;
}

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

