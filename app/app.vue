<template>
  <div class="h-screen w-screen relative overflow-hidden bg-gray-100 flex flex-col font-sans">
    <!-- Map Container -->
    <div ref="mapContainer" class="flex-1 w-full h-full" />

    <!-- Error Banner -->
    <div v-if="error" class="absolute top-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 shadow-md flex justify-between items-center">
      <span><strong>Error:</strong> {{ error }}</span>
      <button @click="error = null" class="font-bold text-xl leading-none">&times;</button>
    </div>

    <!-- UI Overlay: Top Bar -->
    <div class="absolute top-0 left-0 right-0 p-4 z-10 pointer-events-none flex flex-col space-y-3">
      <div class="flex justify-between items-start">
        <div class="bg-white/90 backdrop-blur rounded-2xl shadow-lg p-3 pointer-events-auto border border-white/20">
          <h1 class="text-xl font-extrabold text-gray-800 tracking-tight">AudioTour<span class="text-indigo-600">AI</span></h1>
          <p class="text-[10px] uppercase tracking-widest text-gray-400 font-bold">Evidence-Based Discovery</p>
        </div>

        <div class="flex flex-col space-y-2 pointer-events-auto">
          <button 
            @click="centerMap" 
            class="bg-white p-3 rounded-full shadow-lg text-indigo-600 hover:bg-indigo-50 transition-all hover:scale-110 active:scale-95 border border-gray-100"
            title="Center on my location"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          </button>
          <button 
            @click="showFavorites = !showFavorites" 
            class="p-3 rounded-full shadow-lg transition-all hover:scale-110 active:scale-95 border border-gray-100"
            :class="showFavorites ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600'"
            title="Favorites"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" :fill="showFavorites ? 'currentColor' : 'none'"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- UI Overlay: Favorites List -->
    <div v-if="showFavorites" class="absolute inset-0 bg-white/95 backdrop-blur-md z-40 p-8 flex flex-col animate-in">
      <div class="flex justify-between items-center mb-8">
        <h2 class="text-3xl font-black text-gray-900">Your Favorites</h2>
        <button @click="showFavorites = false" class="p-3 bg-gray-100 rounded-2xl text-gray-500 hover:bg-gray-200">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto space-y-4 no-scrollbar">
        <div v-if="favorites.length === 0" class="text-center py-20 text-gray-400">
           <p class="font-bold">No favorites yet.</p>
           <p class="text-xs">Save guides you find interesting!</p>
        </div>
        <div 
          v-for="fav in favorites" 
          :key="fav.id"
          class="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex items-center justify-between"
          @click="openSavedGuide(fav)"
        >
          <div class="flex-1 pr-4">
            <h3 class="font-extrabold text-gray-900">{{ fav.name }}</h3>
            <p class="text-xs text-gray-500">{{ fav.vicinity }}</p>
          </div>
          <button @click.stop="toggleFavorite(fav)" class="text-indigo-600">
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- UI Overlay: Bottom Sheet for Places -->
    <div class="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-20 max-h-[60vh] flex flex-col transition-all duration-500 ease-in-out border-t border-gray-100" :class="{'translate-y-full opacity-0': isPlayingGuide || showFavorites}">
      <div class="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-4 mb-2"></div>
      
      <!-- List Header with Integrated Filters -->
      <div class="px-8 pt-4 pb-2">
        <div class="flex justify-between items-center mb-4">
          <div>
            <h2 class="text-xl font-black text-gray-900">{{ currentCategoryLabel }} Near You</h2>
            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{{ currentRadius }}m scan radius</p>
          </div>
          <button 
            @click="refreshScan" 
            :disabled="isFetchingPlaces"
            class="p-2 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            <svg v-if="isFetchingPlaces" class="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>
          </button>
        </div>

        <!-- Inline Filters -->
        <div class="flex space-x-2 overflow-x-auto pb-4 no-scrollbar">
          <button 
            v-for="f in categories" 
            :key="f.id"
            @click="setCategory(f.id)"
            class="px-4 py-2 rounded-xl text-[10px] font-black transition-all whitespace-nowrap border uppercase tracking-widest"
            :class="currentCategory === f.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 text-gray-500 border-gray-100'"
          >
            {{ f.label }}
          </button>
        </div>
      </div>

      <div class="overflow-y-auto px-6 pb-6 space-y-4 flex-1 no-scrollbar">
        <div v-if="filteredPlaces.length === 0 && !isFetchingPlaces" class="text-center text-gray-400 py-12 flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mb-4 opacity-20"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <p class="font-bold">No locations in this category.</p>
          <button @click="loadMore" class="mt-4 text-indigo-600 font-black text-xs uppercase tracking-widest">Load More</button>
        </div>
        
        <div 
          v-for="place in filteredPlaces" 
          :key="place.id"
          class="bg-gray-50/50 rounded-[2rem] p-5 flex items-center justify-between hover:bg-white hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-indigo-100 group"
          @click="generateGuide(place)"
        >
          <div class="flex-1 pr-4">
            <h3 class="font-extrabold text-gray-900 group-hover:text-indigo-600 transition-colors">{{ place.name }}</h3>
            <div class="flex items-center space-x-2">
              <span v-if="isCached(place.id)" class="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-black uppercase">Cached</span>
              <p class="text-xs text-gray-500 font-medium">{{ place.vicinity }}</p>
            </div>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-white text-indigo-600 flex items-center justify-center shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:rotate-12">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </div>
        </div>

        <!-- Load More Button -->
        <div v-if="filteredPlaces.length > 0 || isFetchingPlaces" class="pt-2 pb-6">
           <button 
             @click="loadMore" 
             :disabled="isFetchingPlaces"
             class="w-full py-4 border-2 border-dashed border-gray-200 rounded-[2rem] text-gray-400 font-black text-[10px] uppercase tracking-[0.2em] hover:border-indigo-200 hover:text-indigo-400 transition-all active:scale-95"
           >
             {{ isFetchingPlaces ? 'Scanning...' : 'Load More' }}
           </button>
        </div>
      </div>
    </div>

    <!-- UI Overlay: Player View -->
    <div 
      v-if="isPlayingGuide"
      class="absolute inset-0 bg-white z-30 flex flex-col p-8 animate-in"
    >
      <div class="flex justify-between items-center mb-8">
        <div class="flex items-center space-x-4">
           <button @click="toggleFavorite(selectedPlace)" class="p-3 bg-gray-50 rounded-2xl text-indigo-600 hover:bg-indigo-50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" :fill="isFavorite(selectedPlace?.id) ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
           </button>
           <div class="flex items-center space-x-2">
              <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Verified Evidence</span>
           </div>
        </div>
        <button @click="closePlayer" class="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:bg-gray-100 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div class="flex-1 flex flex-col overflow-hidden">
        <h2 class="text-3xl font-black text-gray-900 mb-2 leading-tight">{{ selectedPlace?.name }}</h2>
        <p class="text-sm font-bold text-indigo-600 mb-6">{{ selectedPlace?.vicinity }}</p>

        <!-- Research Evidence Box -->
        <div v-if="searchLogs.length > 0" class="mb-6 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
           <p class="text-[10px] font-black uppercase tracking-[0.1em] text-indigo-400 mb-3">Agent Research Path</p>
           <div class="space-y-3 max-h-[15vh] overflow-y-auto pr-2 no-scrollbar">
              <div v-for="(log, i) in searchLogs" :key="i" class="text-xs">
                <p class="font-bold text-gray-700 mb-1">🔍 "{{ log.query }}"</p>
                <div class="flex flex-wrap gap-1">
                  <a v-for="(link, j) in log.links" :key="j" :href="link.url" target="_blank" class="bg-white px-2 py-1 rounded-lg border border-gray-100 text-[10px] text-indigo-600 hover:text-indigo-800 underline truncate max-w-[150px]">
                    {{ link.title }}
                  </a>
                </div>
              </div>
           </div>
        </div>

        <!-- Script Preview -->
        <div class="flex-1 w-full bg-gray-50 rounded-[2.5rem] p-8 text-left shadow-inner border border-gray-100 overflow-y-auto relative min-h-0 no-scrollbar">
          <div v-if="isGenerating" class="flex flex-col items-center justify-center h-full text-center space-y-6">
             <div class="relative">
                <div class="w-20 h-20 bg-indigo-600 rounded-3xl animate-spin-slow"></div>
                <div class="absolute inset-0 flex items-center justify-center text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8l-4 4 4 4"/><path d="M16 12l-4-4"/><path d="M16 12l4 4"/></svg>
                </div>
             </div>
             <div>
               <p class="text-lg font-black text-gray-900">Scouring records...</p>
               <p class="text-xs font-medium text-gray-400">Filtering for specific dates and materials</p>
             </div>
          </div>
          <div v-else class="animate-in delay-150">
             <p class="text-gray-800 leading-relaxed text-xl font-medium font-serif italic selection:bg-indigo-100">
               "{{ generatedScript || 'No specific historical records found.' }}"
             </p>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="mt-8 space-y-4">
        <div v-if="!audioUrl && !isGenerating && generatedScript" class="flex flex-col items-center animate-in">
          <button 
            @click="speakAloud" 
            :disabled="isConvertingToSpeech"
            class="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center space-x-3 disabled:opacity-50"
          >
            <svg v-if="isConvertingToSpeech" class="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            <span>{{ isConvertingToSpeech ? 'Generating Audio...' : 'Hear Fact-Based Guide' }}</span>
          </button>
        </div>

        <div v-if="audioUrl" class="bg-gray-900 rounded-[2rem] p-4 shadow-2xl flex items-center animate-in">
           <audio ref="audioPlayer" :src="audioUrl" controls autoplay class="w-full h-12 outline-none invert brightness-200 contrast-200">
             Your browser does not support the audio element.
           </audio>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useGeolocation, useLocalStorage } from '@vueuse/core'
import { setOptions, importLibrary } from '@googlemaps/js-api-loader'

// State
const mapContainer = ref<HTMLElement | null>(null)
let map: google.maps.Map | null = null
let Marker: any = null
let userMarker: any = null
const markers: any[] = []

const error = ref<string | null>(null)
const places = ref<any[]>([]) // Global store of discovered places
const isFetchingPlaces = ref(false)
const showFavorites = ref(false)

const currentRadius = ref(500)
const currentCategory = ref('all')
const categories = [
  { id: 'all', label: 'All' },
  { id: 'history', label: 'History' },
  { id: 'culture', label: 'Culture' },
  { id: 'nature', label: 'Nature' }
]

// Category matching logic
const categoryTypes: Record<string, string[]> = {
  culture: ['museum', 'art_gallery', 'cultural_center', 'library'],
  nature: ['beach', 'hiking_area', 'national_park', 'park', 'zoo'],
  history: ['historical_landmark', 'monument', 'church', 'castle', 'tourist_attraction']
}

// Computed Filtered List
const filteredPlaces = computed(() => {
  if (currentCategory.value === 'all') return places.value
  const allowed = categoryTypes[currentCategory.value] || []
  return places.value.filter(p => (p.types || []).some((t: string) => allowed.includes(t)))
})

const currentCategoryLabel = computed(() => categories.find(c => c.id === currentCategory.value)?.label)

// Local Storage for caching and favorites
const guideCache = useLocalStorage<Record<string, any>>('audio_tour_cache', {})
const favorites = useLocalStorage<any[]>('audio_tour_favorites', [])

const selectedPlace = ref<any>(null)
const isGenerating = ref(false)
const isConvertingToSpeech = ref(false)
const isPlayingGuide = ref(false)
const generatedScript = ref('')
const searchLogs = ref<any[]>([])
const audioUrl = ref('')
const audioPlayer = ref<HTMLAudioElement | null>(null)

// Geolocation
const { coords, resume, isSupported } = useGeolocation({ enableHighAccuracy: true })
const runtimeConfig = useRuntimeConfig()

// Initialize Map
onMounted(async () => {
  if (!isSupported.value) { error.value = "Geolocation not supported."; return }
  resume()
  const apiKey = runtimeConfig.public.googleMapsApiKey
  if (!apiKey) { error.value = "Google Maps API Key missing."; return }

  try {
    // The 'right' way according to modern docs
    setOptions({ 
      apiKey, 
      version: "weekly"
    })
    
    // Load libraries using importLibrary
    const { Map } = await importLibrary("maps") as google.maps.MapsLibrary
    const { Marker: LegacyMarker } = await importLibrary("marker") as google.maps.MarkerLibrary
    await importLibrary("places") // Load places library for future client-side use if needed
    
    Marker = LegacyMarker

    // Initial center (will be updated by watcher once coords are ready)
    const initialPos = coords.value && coords.value.latitude !== Infinity 
      ? { lat: coords.value.latitude, lng: coords.value.longitude }
      : { lat: 0, lng: 0 }

    map = new Map(mapContainer.value as HTMLElement, {
      center: initialPos,
      zoom: 15,
      disableDefaultUI: true,
      zoomControl: false,
      mapId: 'DEMO_MAP_ID', // Required for some advanced features, can be any string for now
      styles: [
        { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#e9e9e9" }, { "lightness": 17 }] },
        { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }, { "lightness": 20 }] },
        { "featureType": "road.highway", "elementType": "geometry.fill", "stylers": [{ "color": "#ffffff" }, { "lightness": 17 }] },
        { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }, { "lightness": 21 }] },
      ]
    })

    userMarker = new Marker({
      map,
      title: "You",
      position: initialPos,
      icon: { 
        path: 0, // google.maps.SymbolPath.CIRCLE
        scale: 10, 
        fillColor: "#4F46E5", 
        fillOpacity: 1, 
        strokeWeight: 4, 
        strokeColor: "#ffffff" 
      }
    })

    // If we already have coords, fetch places immediately
    if (coords.value && coords.value.latitude !== Infinity) {
      fetchPlaces()
    }
  } catch (err: any) {
    console.error("Maps Load Error:", err)
    error.value = "Failed to load maps: " + err.message
  }
})

watch(() => coords.value, (newCoords) => {
  if (newCoords && newCoords.latitude !== Infinity && map && userMarker) {
    const pos = { lat: newCoords.latitude, lng: newCoords.longitude }
    userMarker.setPosition(pos)
    if (places.value.length === 0 && !isFetchingPlaces.value) {
      map.setCenter(pos)
      fetchPlaces()
    }
  }
}, { deep: true })

const centerMap = () => {
  if (map && coords.value && coords.value.latitude !== Infinity) {
    map.setCenter({ lat: coords.value.latitude, lng: coords.value.longitude })
    map.setZoom(17)
  }
}

const fetchPlaces = async () => {
  if (!coords.value || coords.value.latitude === Infinity) return
  isFetchingPlaces.value = true
  error.value = null
  try {
    const { latitude, longitude } = coords.value
    const res = await $fetch(`/api/places?lat=${latitude}&lng=${longitude}&radius=${currentRadius.value}&type=${currentCategory.value}`)
    
    const newPlaces = (res as any).places
    const existingIds = new Set(places.value.map(p => p.id))
    const uniqueNewPlaces = newPlaces.filter((p: any) => !existingIds.has(p.id))
    
    // Add to global memory without clearing existing ones
    places.value = [...places.value, ...uniqueNewPlaces]
    updateMarkers()
  } catch (err: any) {
    error.value = err.message || "Failed to fetch places."
  } finally {
    isFetchingPlaces.value = false
  }
}

const updateMarkers = () => {
  clearMarkers()
  // Show markers for currently filtered places
  filteredPlaces.value.forEach(place => {
    if (place.location && map && Marker) {
      const marker = new Marker({
        position: place.location,
        map,
        title: place.name,
        icon: { url: "http://maps.google.com/mapfiles/ms/icons/red-dot.png" }
      })
      marker.addListener('click', () => generateGuide(place))
      markers.push(marker)
    }
  })
}

const clearMarkers = () => {
  markers.forEach(m => m.setMap(null))
  markers.length = 0
}

const setCategory = (id: string) => {
  currentCategory.value = id
  updateMarkers() // Show markers for existing places in this category
  
  // If we have very few places for this category, trigger a fetch
  if (filteredPlaces.value.length < 5) {
    fetchPlaces()
  }
}

const refreshScan = () => {
  currentRadius.value = 500
  places.value = [] // Reset warehouse on hard refresh
  fetchPlaces()
}

const loadMore = () => {
  currentRadius.value += 1000
  if (currentRadius.value > 10000) currentRadius.value = 10000
  fetchPlaces()
}

const isCached = (id: string) => !!guideCache.value[id]
const isFavorite = (id: string) => favorites.value.some(f => f.id === id)

const toggleFavorite = (place: any) => {
  if (!place) return
  const index = favorites.value.findIndex(f => f.id === place.id)
  if (index > -1) {
    favorites.value.splice(index, 1)
  } else {
    favorites.value.push({ ...place, ...(guideCache.value[place.id] || {}) })
  }
}

const openSavedGuide = (saved: any) => {
  selectedPlace.value = saved
  generatedScript.value = saved.script || ''
  searchLogs.value = saved.sources || []
  audioUrl.value = saved.audioUrl || ''
  isPlayingGuide.value = true
  showFavorites.value = false
}

const generateGuide = async (place: any) => {
  if (isGenerating.value) return
  if (guideCache.value[place.id]) {
    openSavedGuide({ ...place, ...guideCache.value[place.id] })
    return
  }
  selectedPlace.value = place
  isPlayingGuide.value = true
  isGenerating.value = true
  generatedScript.value = ''
  searchLogs.value = []
  audioUrl.value = ''
  error.value = null
  try {
    const res: any = await $fetch('/api/generate-guide', {
      method: 'POST',
      body: {
        name: place.name,
        vicinity: place.vicinity,
        userLocation: { lat: coords.value.latitude, lng: coords.value.longitude },
        placeLocation: place.location
      }
    })
    generatedScript.value = res.script
    searchLogs.value = res.sources || []
    guideCache.value[place.id] = { script: res.script, sources: res.sources, timestamp: Date.now() }
  } catch (err: any) {
    error.value = err.message || "Research failed."
  } finally {
    isGenerating.value = false
  }
}

const speakAloud = async () => {
  if (isConvertingToSpeech.value || !generatedScript.value) return
  if (selectedPlace.value && guideCache.value[selectedPlace.value.id]?.audioUrl) {
    audioUrl.value = guideCache.value[selectedPlace.value.id].audioUrl
    return
  }
  isConvertingToSpeech.value = true
  error.value = null
  try {
    const res: any = await $fetch('/api/text-to-speech', { method: 'POST', body: { text: generatedScript.value } })
    audioUrl.value = res.audioBase64
    if (selectedPlace.value && guideCache.value[selectedPlace.value.id]) {
      guideCache.value[selectedPlace.value.id].audioUrl = res.audioBase64
    }
  } catch (err: any) {
    error.value = err.message || "TTS failed."
  } finally {
    isConvertingToSpeech.value = false
  }
}

const closePlayer = () => {
  isPlayingGuide.value = false
  if (audioPlayer.value) audioPlayer.value.pause()
  setTimeout(() => {
    audioUrl.value = ''; generatedScript.value = ''; searchLogs.value = []; selectedPlace.value = null
  }, 500)
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@1,400;1,700&display=swap');
body { font-family: 'Plus Jakarta Sans', sans-serif; }
.font-serif { font-family: 'Playfair Display', serif; }
.animate-in { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@keyframes slide-up { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
.animate-spin-slow { animation: spin 3s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
