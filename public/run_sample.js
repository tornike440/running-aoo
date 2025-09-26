class RunningTracker {
    constructor() {
        this.isRunning = false;
        this.locations = [];
        this.watchId = null;
        this.startTime = null;
        this.totalDistance = 0;
        this.claimedArea = 0;
        
        this.map = null;
        this.routePolyline = null;
        this.areaPolygon = null;
        this.startMarker = null;
        this.currentMarker = null;
        
        this.initializeElements();
        this.initializeGoogleMap();
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

    initializeGoogleMap() {
        // Default center (will be updated with user's location)
        const defaultCenter = { lat: 51.505, lng: -0.09 };
        
        // Initialize Google Map
        this.map = new google.maps.Map(this.mapElement, {
            zoom: 13,
            center: defaultCenter,
            mapTypeId: 'terrain',
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                }
            ]
        });

        // Try to center on user's location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    this.map.setCenter(userLocation);
                    this.map.setZoom(16);
                    
                    // Add a marker for current location
                    new google.maps.Marker({
                        position: userLocation,
                        map: this.map,
                        title: 'Your current location',
                        icon: {
                            url: 'data:image/svg+xml;base64,' + btoa(`
                                <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="10" cy="10" r="8" fill="#4285F4" stroke="white" stroke-width="2"/>
                                </svg>
                            `)
                        }
                    });
                },
                (error) => {
                    console.log('Error getting location:', error);
                }
            );
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
        this.updateMap();
        this.updateUI();
        console.log('Run stopped!');
    }

    updatePosition(position) {
        const { latitude, longitude, accuracy } = position.coords;
        const newLocation = { 
            lat: latitude, 
            lng: longitude, 
            accuracy, 
            timestamp: Date.now() 
        };

        // Add to locations array
        this.locations.push(newLocation);

        // Calculate distance from previous point
        if (this.locations.length > 1) {
            const prevLocation = this.locations[this.locations.length - 2];
            const distance = google.maps.geometry.spherical.computeDistanceBetween(
                new google.maps.LatLng(prevLocation.lat, prevLocation.lng),
                new google.maps.LatLng(newLocation.lat, newLocation.lng)
            );
            this.totalDistance += distance;
        }

        this.updateMap();
        this.updateUI();
    }

    calculateClaimedArea() {
        if (this.locations.length < 3) return 0;

        // Use Google Maps geometry library for accurate area calculation
        const path = this.locations.map(loc => 
            new google.maps.LatLng(loc.lat, loc.lng)
        );
        
        this.claimedArea = Math.abs(google.maps.geometry.spherical.computeArea(path));
        return this.claimedArea;
    }

    updateMap() {
        // Clear previous map elements
        if (this.routePolyline) this.routePolyline.setMap(null);
        if (this.areaPolygon) this.areaPolygon.setMap(null);
        if (this.currentMarker) this.currentMarker.setMap(null);

        // Draw route polyline
        if (this.locations.length > 1) {
            const path = this.locations.map(loc => 
                new google.maps.LatLng(loc.lat, loc.lng)
            );
            
            this.routePolyline = new google.maps.Polyline({
                path: path,
                geodesic: true,
                strokeColor: '#4285F4',
                strokeOpacity: 1.0,
                strokeWeight: 4,
                map: this.map
            });
        }

        // Draw area polygon if we have a closed route
        if (this.locations.length >= 3 && !this.isRunning) {
            const path = this.locations.map(loc => 
                new google.maps.LatLng(loc.lat, loc.lng)
            );
            
            this.areaPolygon = new google.maps.Polygon({
                paths: path,
                strokeColor: '#EA4335',
                strokeOpacity: 0.8,
                strokeWeight: 3,
                fillColor: '#EA4335',
                fillOpacity: 0.35,
                map: this.map
            });
        }

        // Add markers for start and current position
        if (this.locations.length > 0) {
            const startLoc = this.locations[0];
            
            // Start marker (only once)
            if (!this.startMarker) {
                this.startMarker = new google.maps.Marker({
                    position: new google.maps.LatLng(startLoc.lat, startLoc.lng),
                    map: this.map,
                    title: 'Start Point',
                    icon: {
                        url: 'data:image/svg+xml;base64,' + btoa(`
                            <svg width="25" height="25" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12.5" cy="12.5" r="10" fill="#34A853" stroke="white" stroke-width="2"/>
                            </svg>
                        `)
                    }
                });
            }

            // Current position marker (updates in real-time)
            if (this.isRunning) {
                const currentLoc = this.locations[this.locations.length - 1];
                this.currentMarker = new google.maps.Marker({
                    position: new google.maps.LatLng(currentLoc.lat, currentLoc.lng),
                    map: this.map,
                    title: 'Current Position',
                    icon: {
                        url: 'data:image/svg+xml;base64,' + btoa(`
                            <svg width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="10" cy="10" r="8" fill="#4285F4" stroke="white" stroke-width="2"/>
                            </svg>
                        `)
                    }
                });
            }
        }
    }

    clearMap() {
        if (this.routePolyline) this.routePolyline.setMap(null);
        if (this.areaPolygon) this.areaPolygon.setMap(null);
        if (this.startMarker) {
            this.startMarker.setMap(null);
            this.startMarker = null;
        }
        if (this.currentMarker) {
            this.currentMarker.setMap(null);
            this.currentMarker = null;
        }
    }

    updateUI() {
        this.statusElement.textContent = this.isRunning ? 'Running...' : 'Stopped';
        this.distanceElement.textContent = (this.totalDistance / 1000).toFixed(2) + ' km';
        this.areaElement.textContent = (this.claimedArea / 10000).toFixed(2) + ' hectares';
        
        // Enable/disable buttons
        this.startButton.disabled = this.isRunning;
        this.stopButton.disabled = !this.isRunning;
        
        if (this.startTime) {
            const currentTime = this.isRunning ? new Date() : new Date();
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