class RunningTracker {
    constructor() {
        this.isRunning = false;
        this.locations = [];
        this.watchId = null;
        this.startTime = null;
        this.totalDistance = 0;
        this.claimedArea = 0;
        
        this.initializeElements();
        this.initializeMap();
        this.setupEventListeners();
    }

    initializeElements() {
        this.startButton = document.getElementById('startButton');
        this.stopButton = document.getElementById('stopButton');
        this.statusElement = document.getElementById('status');
        this.distanceElement = document.getElementById('distance');
        this.areaElement = document.getElementById('area');
        this.timeElement = document.getElementById('time');
        this.mapElement = document.getElementById('map');
    }

    initializeMap() {
        // Initialize Leaflet map
        this.map = L.map('map').setView([51.505, -0.09], 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);

        // Create layers
        this.routeLayer = L.layerGroup().addTo(this.map);
        this.areaLayer = L.layerGroup().addTo(this.map);
        
        // Try to center on user's location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords;
                this.map.setView([latitude, longitude], 16);
            });
        }
    }

    setupEventListeners() {
        this.startButton.addEventListener('click', () => this.startRun());
        this.stopButton.addEventListener('click', () => this.stopRun());
    }

    startRun() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.locations = [];
        this.totalDistance = 0;
        this.claimedArea = 0;
        this.startTime = new Date();
        
        this.updateUI();
        this.clearMap();

        // Start tracking position
        if (navigator.geolocation) {
            this.watchId = navigator.geolocation.watchPosition(
                (position) => this.updatePosition(position),
                (error) => this.handleGeolocationError(error),
                {
                    enableHighAccuracy: true,
                    timeout: 5000,
                    maximumAge: 0
                }
            );
        }

        console.log('Run started!');
    }

    stopRun() {
        if (!this.isRunning) return;

        this.isRunning = false;
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }

        this.calculateClaimedArea();
        this.updateUI();
        console.log('Run stopped!');
    }

    updatePosition(position) {
        const { latitude, longitude, accuracy } = position.coords;
        const newLocation = { lat: latitude, lng: longitude, accuracy, timestamp: Date.now() };

        // Add to locations array
        this.locations.push(newLocation);

        // Calculate distance from previous point
        if (this.locations.length > 1) {
            const prevLocation = this.locations[this.locations.length - 2];
            const distance = this.calculateDistance(prevLocation, newLocation);
            this.totalDistance += distance;
        }

        this.updateMap();
        this.updateUI();
    }

    calculateDistance(loc1, loc2) {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = loc1.lat * Math.PI / 180;
        const φ2 = loc2.lat * Math.PI / 180;
        const Δφ = (loc2.lat - loc1.lat) * Math.PI / 180;
        const Δλ = (loc2.lng - loc1.lng) * Math.PI / 180;

        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

        return R * c;
    }

    calculateClaimedArea() {
        if (this.locations.length < 3) return 0;

        // Simple polygon area calculation using shoelace formula
        let area = 0;
        const n = this.locations.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += this.locations[i].lng * this.locations[j].lat;
            area -= this.locations[j].lng * this.locations[i].lat;
        }

        this.claimedArea = Math.abs(area) * 111319.9 * 111319.9 / 2; // Convert to square meters
        return this.claimedArea;
    }

    updateMap() {
        // Clear previous layers
        this.routeLayer.clearLayers();
        this.areaLayer.clearLayers();

        // Draw route
        if (this.locations.length > 1) {
            const latLngs = this.locations.map(loc => [loc.lat, loc.lng]);
            const polyline = L.polyline(latLngs, { color: 'blue', weight: 5 }).addTo(this.routeLayer);
        }

        // Draw area polygon if we have a closed route
        if (this.locations.length >= 3 && !this.isRunning) {
            const latLngs = this.locations.map(loc => [loc.lat, loc.lng]);
            const polygon = L.polygon(latLngs, { 
                color: 'red', 
                fillColor: '#f03', 
                fillOpacity: 0.5 
            }).addTo(this.areaLayer);
        }

        // Add markers for start and current position
        if (this.locations.length > 0) {
            const startLoc = this.locations[0];
            L.marker([startLoc.lat, startLoc.lng])
                .addTo(this.routeLayer)
                .bindPopup('Start Point')
                .openPopup();

            if (this.isRunning) {
                const currentLoc = this.locations[this.locations.length - 1];
                L.marker([currentLoc.lat, currentLoc.lng])
                    .addTo(this.routeLayer)
                    .bindPopup('Current Position');
            }
        }
    }

    clearMap() {
        this.routeLayer.clearLayers();
        this.areaLayer.clearLayers();
    }

    updateUI() {
        this.statusElement.textContent = this.isRunning ? 'Running...' : 'Stopped';
        this.distanceElement.textContent = (this.totalDistance / 1000).toFixed(2) + ' km';
        this.areaElement.textContent = (this.claimedArea / 10000).toFixed(2) + ' hectares';
        
        if (this.startTime) {
            const currentTime = this.isRunning ? new Date() : this.startTime;
            const elapsed = Math.floor((currentTime - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.timeElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    handleGeolocationError(error) {
        console.error('Geolocation error:', error);
        alert('Error getting location: ' + error.message);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.runningTracker = new RunningTracker();
});