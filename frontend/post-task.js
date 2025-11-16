import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let map;
let marker;
let geocoderCache = {}; // Cache for geocoding results

// Check authentication
onAuthStateChanged(auth, (user) => {
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
    
    // Initialize map after DOM is ready
    setTimeout(initMap, 100);
});

// Initialize Leaflet Map
function initMap() {
    const defaultLocation = [40.7128, -74.0060]; // New York default [lat, lng]
    
    // Create map
    map = L.map('map').setView(defaultLocation, 13);
    
    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    // Try to get user's current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = [position.coords.latitude, position.coords.longitude];
                map.setView(userLocation, 15);
                
                // Set initial marker at user location
                if (!marker) {
                    marker = L.marker(userLocation, { draggable: true }).addTo(map);
                    // Add drag handler
                    marker.on('dragend', (e) => {
                        const position = marker.getLatLng();
                        updateLocationFromMarker([position.lat, position.lng]);
                    });
                    updateLocationFromMarker(userLocation);
                }
            },
            () => {
                console.log("Geolocation not available");
            }
        );
    }
    
    // Add click listener to map
    map.on('click', (e) => {
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        // Update or create marker
        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng], { draggable: true }).addTo(map);
            // Add drag handler when marker is created
            marker.on('dragend', (e) => {
                const position = marker.getLatLng();
                updateLocationFromMarker([position.lat, position.lng]);
            });
        }
        
        updateLocationFromMarker([lat, lng]);
    });
    
    // Address search functionality
    const addressInput = document.getElementById("location_address");
    let searchTimeout;
    
    addressInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length > 3) {
            searchTimeout = setTimeout(() => {
                searchAddress(query);
            }, 500); // Debounce search
        }
    });
    
    // Handle Enter key on address input
    addressInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = addressInput.value.trim();
            if (query) {
                searchAddress(query);
            }
        }
    });
}

// Update location fields from marker position
async function updateLocationFromMarker(latlng) {
    const lat = latlng[0];
    const lng = latlng[1];
    
    document.getElementById("location_lat").value = lat;
    document.getElementById("location_lng").value = lng;
    
    // Reverse geocode to get address
    try {
        const address = await reverseGeocode(lat, lng);
        if (address) {
            document.getElementById("location_address").value = address;
        }
    } catch (error) {
        console.error("Geocoding error:", error);
    }
}

// Reverse geocode using Nominatim (OpenStreetMap)
async function reverseGeocode(lat, lng) {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    
    if (geocoderCache[cacheKey]) {
        return geocoderCache[cacheKey];
    }
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'Taskerrand/1.0' // Required by Nominatim
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            const address = data.display_name || `${lat}, ${lng}`;
            geocoderCache[cacheKey] = address;
            return address;
        }
    } catch (error) {
        console.error("Reverse geocoding error:", error);
    }
    
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// Search address using Nominatim
async function searchAddress(query) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'Taskerrand/1.0' // Required by Nominatim
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.length > 0) {
                // Use first result
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lng = parseFloat(result.lon);
                
                document.getElementById("location_lat").value = lat;
                document.getElementById("location_lng").value = lng;
                document.getElementById("location_address").value = result.display_name;
                
                // Update map
                map.setView([lat, lng], 15);
                
                if (marker) {
                    marker.setLatLng([lat, lng]);
                } else {
                    marker = L.marker([lat, lng], { draggable: true }).addTo(map);
                    // Add drag handler when marker is created
                    marker.on('dragend', (e) => {
                        const position = marker.getLatLng();
                        updateLocationFromMarker([position.lat, position.lng]);
                    });
                }
            } else {
                alert("Address not found. Please try a different search term or click on the map to select a location.");
            }
        }
    } catch (error) {
        console.error("Address search error:", error);
        alert("Error searching address. Please click on the map to select a location.");
    }
}

// Form submission
document.getElementById("task-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const errorDiv = document.getElementById("error-message");
    errorDiv.innerHTML = "";
    
    const formData = {
        title: document.getElementById("title").value,
        description: document.getElementById("description").value,
        payment: parseFloat(document.getElementById("payment").value),
        contact_number: document.getElementById("contact_number").value || null,
        location_lat: parseFloat(document.getElementById("location_lat").value),
        location_lng: parseFloat(document.getElementById("location_lng").value),
        location_address: document.getElementById("location_address").value || null,
        schedule: document.getElementById("schedule").value ? new Date(document.getElementById("schedule").value).toISOString() : null
    };
    
    if (!formData.location_lat || !formData.location_lng) {
        errorDiv.innerHTML = "<div class='error'>Please select a location on the map</div>";
        return;
    }
    
    try {
        await api.createTask(formData);
        alert("Task posted successfully!");
        window.location.href = "./dashboard.html";
    } catch (error) {
        errorDiv.innerHTML = `<div class='error'>Error: ${error.message}</div>`;
    }
});

// Logout
const logoutBtn = document.getElementById("google-logout-btn-id");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "./index.html";
        });
    });
}
