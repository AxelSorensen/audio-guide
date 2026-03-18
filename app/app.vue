<template>
  <div
    class="h-screen w-screen relative overflow-hidden bg-gray-100 flex flex-col font-sans"
  >
    <!-- Map Container with vue3-google-map -->
    <ClientOnly>
      <GoogleMap
        ref="mapRef"
        v-if="apiKey && isMounted"
        :api-key="apiKey"
        class="flex-1 w-full h-full"
        :center="mapCenter"
        :zoom="mapZoom"
        :disable-default-ui="true"
        :gesture-handling="'greedy'"
        :styles="mapStyles"
        :map-id="'bf1cf3607cc60027'"
        @click="isSheetCollapsed = true"
      >
        <!-- Modern User Marker (Standard Marker for stability) -->
        <Marker
          v-if="userPosition"
          :options="{
            position: userPosition,
            zIndex: 1000,
            icon: {
              path: 'M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0',
              fillColor: '#4F46E5',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
              scale: 1,
              anchor: { x: 12, y: 12 },
            },
          }"
        />

        <!-- Clustered Modern Markers -->
        <MarkerCluster
          v-if="clusterAlgorithm"
          :options="{
            algorithm: clusterAlgorithm,
            minimumClusterSize: 2,
          }"
        >
          <CustomMarker
            v-for="place in filteredPlaces"
            :key="place.id"
            :options="{
              position: place.location,
              anchorPoint: 'BOTTOM_CENTER',
            }"
            @click="generateGuide(place)"
          >
            <div class="flex flex-col items-center group">
              <!-- Bubble -->
              <div
                class="bg-white rounded-full px-3 py-1.5 shadow-xl border border-gray-100 group-hover:scale-110 transition-transform cursor-pointer relative z-10"
              >
                <span
                  class="text-[10px] font-black text-indigo-600 truncate max-w-[120px] uppercase tracking-tighter"
                >
                  {{ place.name }}
                </span>
              </div>
              <!-- Pin Tail -->
              <div
                class="w-2.5 h-2.5 bg-white border-r border-b border-gray-100 rotate-45 -mt-1.5 shadow-sm"
              ></div>
            </div>
          </CustomMarker>
        </MarkerCluster>
      </GoogleMap>
    </ClientOnly>

    <!-- Error Banner -->
    <div
      v-if="error"
      class="absolute top-4 left-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 shadow-md flex justify-between items-center animate-in"
    >
      <span class="text-xs text-left"><strong>Error:</strong> {{ error }}</span>
      <button @click="error = null" class="font-bold text-xl leading-none">
        &times;
      </button>
    </div>

    <!-- UI Overlay: Top Bar -->
    <div
      class="absolute top-0 left-0 right-0 p-4 z-10 pointer-events-none flex flex-col space-y-3"
    >
      <div class="flex justify-between items-start">
        <div
          class="bg-white/90 backdrop-blur rounded-2xl shadow-lg p-3 pointer-events-auto border border-white/20 text-left"
        >
          <h1 class="text-xl font-extrabold text-gray-800 tracking-tight">
            AudioTour<span class="text-indigo-600">AI</span>
          </h1>
          <p
            class="text-[10px] uppercase tracking-widest text-gray-400 font-bold"
          >
            Evidence-Based Discovery
          </p>
        </div>

        <div class="flex flex-col space-y-2 pointer-events-auto">
          <!-- Manual Location Request Button -->
          <button
            v-if="!userPosition"
            @click="requestLocation"
            class="bg-indigo-600 p-3 rounded-full shadow-lg text-white hover:bg-indigo-700 transition-all hover:scale-110 active:scale-95 animate-bounce"
            title="Enable Location"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </button>

          <button
            v-if="userPosition"
            @click="centerMap"
            class="bg-white p-3 rounded-full shadow-lg text-indigo-600 hover:bg-indigo-50 transition-all hover:scale-110 active:scale-95 border border-gray-100"
            title="Center on my location"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="3 11 22 2 13 21 11 13 3 11" />
            </svg>
          </button>

          <button
            @click="showFavorites = !showFavorites"
            class="p-3 rounded-full shadow-lg transition-all hover:scale-110 active:scale-95 border border-gray-100"
            :class="
              showFavorites
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600'
            "
            title="Favorites"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              :fill="showFavorites ? 'currentColor' : 'none'"
            >
              <path
                d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- UI Overlay: Favorites List -->
    <div
      v-if="showFavorites"
      class="absolute inset-0 bg-white/95 backdrop-blur-md z-40 p-8 flex flex-col animate-in"
    >
      <div class="flex justify-between items-center mb-8">
        <h2 class="text-3xl font-black text-gray-900 text-left">
          Your Favorites
        </h2>
        <button
          @click="showFavorites = false"
          class="p-3 bg-gray-100 rounded-2xl text-gray-500 hover:bg-gray-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto space-y-4 no-scrollbar">
        <div
          v-if="favorites.length === 0"
          class="text-center py-20 text-gray-400"
        >
          <p class="font-bold">No favorites yet.</p>
          <p class="text-xs">Save guides you find interesting!</p>
        </div>
        <div
          v-for="fav in favorites"
          :key="fav.id"
          class="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex items-center justify-between cursor-pointer"
          @click="openSavedGuide(fav)"
        >
          <div class="flex-1 pr-4 text-left">
            <div class="flex items-center justify-between">
              <h3 class="font-extrabold text-gray-900">{{ fav.name }}</h3>
              <div class="flex items-center space-x-2 shrink-0">
                <div
                  v-if="getFeedback(fav.id).up > 0"
                  class="flex items-center space-x-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="none"
                  >
                    <path
                      d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"
                    />
                  </svg>
                  <span class="text-[9px] font-black">{{
                    getFeedback(fav.id).up
                  }}</span>
                </div>
                <div
                  v-if="getFeedback(fav.id).down > 0"
                  class="flex items-center space-x-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-full"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="none"
                  >
                    <path d="M17 14V2" />
                    <path
                      d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"
                    />
                  </svg>
                  <span class="text-[9px] font-black">{{
                    getFeedback(fav.id).down
                  }}</span>
                </div>
              </div>
            </div>
            <p class="text-xs text-gray-500">{{ fav.vicinity }}</p>
          </div>
          <button @click.stop="toggleFavorite(fav)" class="text-indigo-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <path
                d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- UI Overlay: Bottom Sheet for Places -->
    <div
      class="absolute bottom-0 left-0 right-0 bg-white rounded-t-[2.5rem] shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-20 h-[60vh] min-h-[60vh] max-h-[60vh] flex flex-col border-t border-gray-100 transition-all duration-500 ease-in-out"
      :class="{
        'translate-y-full opacity-0': isPlayingGuide || showFavorites,
        'translate-y-[42.5vh]':
          isSheetCollapsed && !isPlayingGuide && !showFavorites,
        'translate-y-0':
          !isSheetCollapsed && !isPlayingGuide && !showFavorites,
      }"
    >
      <!-- Clickable Handle to Expand/Collapse -->
      <div
        class="w-full pt-4 pb-2 flex-shrink-0 cursor-pointer touch-none"
        @click="isSheetCollapsed = !isSheetCollapsed"
      >
        <div class="w-12 h-1.5 bg-gray-200 rounded-full mx-auto"></div>
      </div>

      <!-- List Header with Integrated Filters -->
      <div class="px-8 pt-4 pb-2 flex-shrink-0 text-left">
        <div class="flex justify-between items-center mb-4">
          <div class="text-left">
            <h2 class="text-xl font-black text-gray-900">
              {{ currentCategoryLabel }} Near You
            </h2>
            <p
              class="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-left"
            >
              {{ currentRadius }}m scan radius
            </p>
          </div>
          <button
            @click="refreshScan"
            :disabled="isFetchingPlaces"
            class="p-2 text-indigo-600 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50"
          >
            <svg
              v-if="isFetchingPlaces"
              class="animate-spin h-5 w-5"
              viewBox="0 0 24 24"
            >
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
                fill="none"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 2v6h-6"></path>
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
              <path d="M3 22v-6h6"></path>
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
            </svg>
          </button>
        </div>

        <!-- Inline Filters -->
        <div class="flex space-x-2 overflow-x-auto pb-4 no-scrollbar">
          <button
            v-for="f in categories"
            :key="f.id"
            @click="setCategory(f.id)"
            class="px-4 py-2 rounded-xl text-[10px] font-black transition-all whitespace-nowrap border uppercase tracking-widest"
            :class="
              currentCategory === f.id
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-gray-50 text-gray-500 border-gray-100'
            "
          >
            {{ f.label }}
          </button>
        </div>
      </div>

      <div class="overflow-y-auto px-6 pb-6 space-y-4 flex-1 no-scrollbar">
        <!-- Skeleton Loaders -->
        <template v-if="isFetchingPlaces && filteredPlaces.length === 0">
          <div
            v-for="i in 3"
            :key="i"
            class="bg-gray-50/50 rounded-[2rem] p-5 flex items-center justify-between animate-pulse"
          >
            <div class="flex-1 pr-4 text-left">
              <div class="h-5 bg-gray-200 rounded-full w-3/4 mb-3"></div>
              <div class="h-3 bg-gray-100 rounded-full w-1/2"></div>
            </div>
            <div class="w-12 h-12 rounded-2xl bg-gray-100"></div>
          </div>
        </template>

        <!-- No Results -->
        <div
          v-else-if="filteredPlaces.length === 0 && !isFetchingPlaces"
          class="text-center text-gray-400 py-12 flex flex-col items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="mb-4 opacity-20"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" x2="12" y1="8" y2="12"></line>
            <line x1="12" x2="12.01" y1="16" y2="16"></line>
          </svg>
          <p class="font-bold">No locations in this category.</p>
          <button
            @click="loadMore"
            class="mt-4 text-indigo-600 font-black text-xs uppercase tracking-widest"
          >
            Load More
          </button>
        </div>

        <!-- Actual List -->
        <div
          v-for="place in filteredPlaces"
          :key="place.id"
          class="bg-gray-50/50 rounded-[2rem] p-5 flex items-center justify-between hover:bg-white hover:shadow-md transition-all cursor-pointer border border-transparent hover:border-indigo-100 group"
          @click="generateGuide(place)"
        >
          <div class="flex-1 pr-4 text-left text-gray-900">
            <div class="flex items-center justify-between">
              <div class="flex items-center space-x-2">
                <svg
                  v-if="isFavorite(place.id)"
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  class="text-red-500 shrink-0"
                >
                  <path
                    d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
                  />
                </svg>
                <h3
                  class="font-extrabold text-gray-900 group-hover:text-indigo-600 transition-colors"
                >
                  {{ place.name }}
                </h3>
              </div>
              <div class="flex items-center space-x-2 shrink-0">
                <div
                  v-if="getFeedback(place.id).up > 0"
                  class="flex items-center space-x-1 text-green-600 bg-green-50 px-2 py-0.5 rounded-full"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="none"
                  >
                    <path
                      d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"
                    />
                  </svg>
                  <span class="text-[9px] font-black">{{
                    getFeedback(place.id).up
                  }}</span>
                </div>
                <div
                  v-if="getFeedback(place.id).down > 0"
                  class="flex items-center space-x-1 text-red-600 bg-red-50 px-2 py-0.5 rounded-full"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    stroke="none"
                  >
                    <path d="M17 14V2" />
                    <path
                      d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"
                    />
                  </svg>
                  <span class="text-[9px] font-black">{{
                    getFeedback(place.id).down
                  }}</span>
                </div>
              </div>
            </div>
            <div class="flex items-center space-x-2 text-left">
              <span
                v-if="isCached(place.id)"
                class="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-black uppercase"
                >Cached</span
              >
              <p class="text-xs text-gray-500 font-medium">
                {{ place.vicinity }}
              </p>
            </div>
          </div>
          <div
            class="w-12 h-12 rounded-2xl bg-white text-indigo-600 flex items-center justify-center shadow-sm group-hover:bg-indigo-600 group-hover:text-white transition-all transform group-hover:rotate-12"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </div>

        <!-- Load More Button -->
        <div
          v-if="filteredPlaces.length > 0 || isFetchingPlaces"
          class="pt-2 pb-6"
        >
          <button
            @click="loadMore"
            :disabled="isFetchingPlaces"
            class="w-full py-4 border-2 border-dashed border-gray-200 rounded-[2rem] text-gray-400 font-black text-[10px] uppercase tracking-[0.2em] hover:border-indigo-200 hover:text-indigo-400 transition-all active:scale-95"
          >
            {{ isFetchingPlaces ? "Scanning..." : "Load More" }}
          </button>
        </div>
      </div>
    </div>

    <!-- UI Overlay: Player View -->
    <div
      v-if="isPlayingGuide"
      class="absolute inset-0 bg-white z-30 flex flex-col p-8 animate-in text-left text-gray-900"
    >
      <div class="flex items-center justify-between mb-6 space-x-4">
        <!-- Subtle Compact Audio Bar -->
        <div
          v-if="audioUrl && !isGenerating"
          class="flex-1 bg-gray-50 rounded-2xl p-1.5 border border-gray-100 flex items-center space-x-3 animate-in relative overflow-hidden h-11"
        >
          <!-- Progress Bar Background -->
          <div class="absolute inset-0 bg-indigo-500/5 pointer-events-none">
            <div
              class="h-full bg-indigo-500/10 transition-all duration-300"
              :style="{ width: audioProgress + '%' }"
            ></div>
          </div>

          <button
            @click="toggleAudio"
            class="w-8 h-8 flex items-center justify-center bg-white text-indigo-600 rounded-xl shadow-sm border border-gray-100 active:scale-95 transition-all relative z-10"
          >
            <svg
              v-if="isAudioPlaying"
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <rect x="6" y="4" width="4" height="16" rx="1"></rect>
              <rect x="14" y="4" width="4" height="16" rx="1"></rect>
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
            >
              <path
                d="M5 3.868v16.264c0 .859.948 1.383 1.678.925l13.116-8.132a1.09 1.09 0 0 0 0-1.85L6.678 2.943C5.948 2.485 5 3.01 5 3.868z"
              ></path>
            </svg>
          </button>

          <div
            class="flex-1 pr-2 relative z-10 cursor-pointer group/progress h-4 flex items-center"
            @click="seekAudio"
          >
            <div
              class="w-full h-1 bg-gray-200 rounded-full overflow-hidden relative"
            >
              <!-- Hover Indicator -->
              <div
                class="absolute inset-0 bg-indigo-200 opacity-0 group-hover/progress:opacity-30 transition-opacity"
              ></div>

              <div
                class="h-full bg-indigo-500 transition-all duration-100"
                :style="{ width: audioProgress + '%' }"
              ></div>
            </div>
          </div>

          <audio
            ref="audioPlayer"
            :src="audioUrl"
            autoplay
            class="hidden"
            @play="isAudioPlaying = true"
            @pause="isAudioPlaying = false"
            @ended="handleAudioEnd"
            @timeupdate="handleAudioTimeUpdate"
            @loadedmetadata="handleAudioMetadata"
          ></audio>
        </div>
        <div v-else class="flex-1"></div>

        <button
          @click="closePlayer"
          class="p-3 bg-gray-50 rounded-2xl text-gray-400 hover:bg-gray-100 transition-colors shrink-0"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div class="flex-1 flex flex-col overflow-hidden text-left">
        <div class="flex flex-col mb-4">
          <div class="flex justify-between items-start mb-1 text-left">
            <h2
              class="text-3xl font-black text-gray-900 leading-tight text-left flex-1 pr-4"
            >
              {{ selectedPlace?.name }}
            </h2>
            <div class="flex items-center space-x-2 shrink-0 pt-1 relative">
              <!-- Floating Heart Animation (Burst) -->
              <div
                v-if="showFloatingHeart"
                class="absolute -top-12 left-1/2 -translate-x-1/2 pointer-events-none z-50 w-12 h-12"
              >
                <div
                  class="absolute animate-float-up text-xl"
                  style="left: -12px; animation-delay: 0s"
                >
                  ❤️
                </div>
                <div
                  class="absolute animate-float-up text-2xl"
                  style="left: 0px; animation-delay: 0.15s; margin-top: -8px"
                >
                  ❤️
                </div>
                <div
                  class="absolute animate-float-up text-xl"
                  style="left: 12px; animation-delay: 0.3s"
                >
                  ❤️
                </div>
              </div>

              <!-- Favorite Button -->
              <button
                @click="toggleFavorite(selectedPlace)"
                class="p-2.5 bg-gray-50 text-indigo-600 rounded-xl hover:bg-indigo-50 transition-colors active:scale-95 group"
                title="Favorite"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  :fill="
                    isFavorite(selectedPlace?.id) ? 'currentColor' : 'none'
                  "
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="group-active:scale-125 transition-transform"
                >
                  <path
                    d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
                  />
                </svg>
              </button>

              <!-- Rerun Button -->
              <button
                v-if="generatedScript && !isGenerating"
                @click="generateGuide(selectedPlace, !!generatedExtra, true)"
                class="p-2.5 bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 hover:text-gray-600 transition-all active:scale-95"
                title="Regenerate Research"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
                  />
                  <path d="M3 3v5h5" />
                  <path
                    d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"
                  />
                  <path d="M16 16h5v5" />
                </svg>
              </button>
            </div>
          </div>
          <p class="text-sm font-bold text-indigo-600 mb-4 text-left">
            {{ selectedPlace?.vicinity }}
          </p>
        </div>

        <!-- Sources List (Horizontal Scroll) -->
        <div v-if="searchLogs.length > 0" class="animate-in mb-4">
          <p
            class="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-3"
          >
            Verified Sources
          </p>
          <div class="flex space-x-2 overflow-x-auto no-scrollbar pb-1">
            <a
              v-for="(link, i) in searchLogs"
              :key="i"
              :href="link.url"
              target="_blank"
              class="bg-gray-50 px-3 py-2 rounded-xl border border-gray-100 text-[10px] font-bold text-gray-500 hover:text-indigo-600 hover:border-indigo-100 transition-all whitespace-nowrap shrink-0"
            >
              {{ link.title }}
            </a>
          </div>
        </div>

        <!-- Script Preview -->
        <div
          class="flex-1 w-full bg-gray-50 rounded-[2.5rem] p-8 text-left shadow-inner border border-gray-100 overflow-y-auto relative min-h-0 no-scrollbar text-left"
        >
          <div
            v-if="isGenerating"
            class="flex flex-col items-center justify-center h-full text-center space-y-6"
          >
            <div class="relative">
              <!-- Simple Rotating Square -->
              <div
                class="w-20 h-20 bg-indigo-600 rounded-3xl animate-spin-slow shadow-xl shadow-indigo-100"
              ></div>
              <div
                class="absolute inset-0 flex items-center justify-center text-white"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8l-4 4 4 4" />
                  <path d="M16 12l-4-4" />
                  <path d="M16 12l4 4" />
                </svg>
              </div>
            </div>
            <div class="h-16 flex flex-col items-center justify-center">
              <transition name="slide-fade" mode="out-in">
                <div :key="currentLoadingIndex" class="text-center">
                  <p class="text-lg font-black text-gray-900 tracking-tight">
                    {{ currentLoadingMessage.title }}
                  </p>
                  <p
                    class="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1"
                  >
                    {{ currentLoadingMessage.sub }}
                  </p>
                </div>
              </transition>
            </div>
          </div>
          <div v-else class="animate-in delay-150 text-left text-gray-900">
            <!-- Discovery Brief Section -->
            <div class="mb-8">
              <div class="flex justify-between items-center mb-4">
                <p
                  class="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400"
                >
                  Discovery Brief
                </p>
                <!-- Discovery Audio Trigger -->
                <button
                  @click="speakAloud('script')"
                  :disabled="isConvertingToSpeech"
                  class="p-2 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                  :class="
                    activeAudioType === 'script' && isAudioPlaying
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                  "
                >
                  <svg
                    v-if="isConvertingToSpeech && activeAudioType === 'script'"
                    class="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                      fill="none"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <svg
                    v-else-if="activeAudioType === 'script' && isAudioPlaying"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                </button>
              </div>
              <p
                class="text-gray-800 leading-relaxed text-xl font-medium selection:bg-indigo-100 text-left"
              >
                {{ generatedScript || "No specific historical records found." }}
              </p>
            </div>

            <!-- Deep Dive Loading State -->
            <div
              v-if="isGeneratingExtra"
              class="mt-8 pt-8 border-t border-gray-100 animate-in space-y-4"
            >
              <div class="flex items-center space-x-3">
                <div
                  class="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"
                ></div>
                <p
                  class="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400"
                >
                  Uncovering deeper layers...
                </p>
              </div>
              <div class="space-y-2">
                <div
                  class="h-3 bg-gray-100 rounded-full w-full animate-pulse"
                ></div>
                <div
                  class="h-3 bg-gray-100 rounded-full w-5/6 animate-pulse"
                ></div>
                <div
                  class="h-3 bg-gray-100 rounded-full w-4/6 animate-pulse"
                ></div>
              </div>
            </div>

            <!-- Deep Dive Content -->
            <div
              v-if="generatedExtra"
              class="mt-8 pt-8 border-t border-gray-100 animate-in"
            >
              <div class="flex justify-between items-center mb-4">
                <p
                  class="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400"
                >
                  Detailed Guide
                </p>
                <!-- Extra Audio Trigger -->
                <button
                  @click="speakAloud('extra')"
                  :disabled="isConvertingToSpeech"
                  class="p-2 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                  :class="
                    activeAudioType === 'extra' && isAudioPlaying
                      ? 'bg-indigo-600 text-white'
                      : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                  "
                >
                  <svg
                    v-if="isConvertingToSpeech && activeAudioType === 'extra'"
                    class="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                      fill="none"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <svg
                    v-else-if="activeAudioType === 'extra' && isAudioPlaying"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                  <svg
                    v-else
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                </button>
              </div>
              <div
                class="prose prose-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-medium"
              >
                {{ generatedExtra }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="mt-8 space-y-4">
        <!-- Tell Me More (Primary Action) -->
        <div
          v-if="
            !generatedExtra &&
            !isGenerating &&
            !isGeneratingExtra &&
            generatedScript
          "
          class="animate-in"
        >
          <button
            @click="generateGuide(selectedPlace, true)"
            class="w-full bg-indigo-600 text-white py-5 rounded-[2rem] font-black text-lg shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center space-x-3"
          >
            <span>Tell me more</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>

        <!-- Feedback Buttons -->
        <div
          v-if="generatedScript && !isGenerating"
          class="flex space-x-3 animate-in delay-300 relative"
        >
          <!-- Floating Feedback Animation (relative to this container) -->
          <div
            v-if="showFloatingFeedback"
            class="absolute -top-16 left-1/2 -translate-x-1/2 pointer-events-none z-50 animate-float-up text-4xl"
          >
            {{ showFloatingFeedback === "up" ? "👍" : "👎" }}
          </div>

          <button
            @click.stop="handleFeedback(selectedPlace.id, 'up')"
            class="flex-1 bg-gray-100 text-gray-500 py-4 rounded-[2rem] hover:bg-green-100 hover:text-green-700 transition-all active:scale-95 flex items-center justify-center border border-gray-200 shadow-sm relative group"
            :class="{
              'bg-green-100 text-green-700 border-green-200':
                getFeedback(selectedPlace?.id).userVote === 'up',
            }"
            title="Helpful"
          >
            <div class="flex items-center space-x-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                :fill="
                  getFeedback(selectedPlace?.id).userVote === 'up'
                    ? 'currentColor'
                    : 'none'
                "
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="group-active:scale-125 transition-transform"
              >
                <path d="M7 10v12" />
                <path
                  d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"
                />
              </svg>
              <span
                v-if="getFeedback(selectedPlace?.id).up > 0"
                class="font-black text-sm"
                >{{ getFeedback(selectedPlace?.id).up }}</span
              >
            </div>
          </button>
          <button
            @click.stop="handleFeedback(selectedPlace.id, 'down')"
            class="flex-1 bg-gray-100 text-gray-500 py-4 rounded-[2rem] hover:bg-red-100 hover:text-red-700 transition-all active:scale-95 flex items-center justify-center border border-gray-200 shadow-sm relative group"
            :class="{
              'bg-red-100 text-red-700 border-red-200':
                getFeedback(selectedPlace?.id).userVote === 'down',
            }"
            title="Not Helpful"
          >
            <div class="flex items-center space-x-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                :fill="
                  getFeedback(selectedPlace?.id).userVote === 'down'
                    ? 'currentColor'
                    : 'none'
                "
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="group-active:scale-125 transition-transform"
              >
                <path d="M17 14V2" />
                <path
                  d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"
                />
              </svg>
              <span
                v-if="getFeedback(selectedPlace?.id).down > 0"
                class="font-black text-sm"
                >{{ getFeedback(selectedPlace?.id).down }}</span
              >
            </div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useGeolocation, useLocalStorage } from "@vueuse/core";
import {
  CustomMarker,
  GoogleMap,
  Marker,
  MarkerCluster,
} from "vue3-google-map";
import type { GridAlgorithm } from "@googlemaps/markerclusterer";

// Geolocation
const { coords, resume, isSupported } = useGeolocation({
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10000,
});

const requestLocation = () => {
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    console.log("[App] Manually requesting location...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("[App] Location received:", position.coords);
        const pos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        userPosition.value = pos;
        mapCenter.value = pos;
        fetchPlaces();
      },
      (err) => {
        console.error("[App] Geolocation error:", err);
        error.value =
          "Location access denied. Please enable location in your settings.";
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }
};

const runtimeConfig = useRuntimeConfig();
const apiKey = runtimeConfig.public.googleMapsApiKey;

// State
const isMounted = ref(false);
const mapRef = ref<any>(null);
const mapCenter = ref({ lat: 55.6761, lng: 12.5683 }); // Default to Copenhagen
const mapZoom = ref(15);
const userPosition = ref<{ lat: number; lng: number } | null>(null);
const error = ref<string | null>(null);
const places = ref<any[]>([]);
const isFetchingPlaces = ref(false);
const showFavorites = ref(false);
const isSheetCollapsed = ref(false);

const currentRadius = ref(500);
const currentCategory = ref("all");
const categories = [
  { id: "all", label: "All" },
  { id: "history", label: "History" },
  { id: "culture", label: "Culture" },
  { id: "nature", label: "Nature" },
];

const mapStyles = [
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#e9e9e9" }, { lightness: 17 }],
  },
  {
    featureType: "landscape",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }, { lightness: 20 }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.fill",
    stylers: [{ color: "#ffffff" }, { lightness: 17 }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#f5f5f5" }, { lightness: 21 }],
  },
];

// Category matching logic
const categoryTypes: Record<string, string[]> = {
  culture: ["museum", "art_gallery", "cultural_center", "library"],
  nature: ["beach", "hiking_area", "national_park", "park", "zoo"],
  history: [
    "historical_landmark",
    "monument",
    "church",
    "castle",
    "tourist_attraction",
  ],
};

const getPlaceIcon = (types: string[] = []) => {
  if (types.some((t) => categoryTypes.history.includes(t))) return "history";
  if (types.some((t) => categoryTypes.nature.includes(t))) return "nature";
  if (types.some((t) => categoryTypes.culture.includes(t))) return "culture";
  return "default";
};

const clusterAlgorithm = ref<any | null>(null);

// Computed Filtered List
const filteredPlaces = computed(() => {
  let list = places.value;
  if (currentCategory.value !== "all") {
    const allowed = categoryTypes[currentCategory.value] || [];
    list = list.filter((p) =>
      (p.types || []).some((t: string) => allowed.includes(t)),
    );
  }
  // Crucial: Filter out any places without valid coordinates to prevent crashes in Google Maps / Clusterer
  return list.filter(
    (p) =>
      p.location &&
      typeof p.location.lat === "number" &&
      typeof p.location.lng === "number",
  );
});

const currentCategoryLabel = computed(
  () => categories.find((c) => c.id === currentCategory.value)?.label,
);

// Local Storage for caching and favorites
const guideCache = useLocalStorage<Record<string, any>>("audio_tour_cache", {});
const favorites = useLocalStorage<any[]>("audio_tour_favorites", []);
const feedbackStore = useLocalStorage<
  Record<string, { up: number; down: number; userVote?: "up" | "down" }>
>("audio_tour_feedback", {});

const getFeedback = (id: string) =>
  feedbackStore.value[id] || { up: 0, down: 0 };

const handleFeedback = (id: string, type: "up" | "down") => {
  if (!feedbackStore.value[id]) {
    feedbackStore.value[id] = { up: 0, down: 0 };
  }

  const current = feedbackStore.value[id];

  // Toggle logic
  if (current.userVote === type) {
    // Remove vote
    current[type]--;
    current.userVote = undefined;
  } else {
    // If they already voted the other way, remove that first
    if (current.userVote) {
      current[current.userVote]--;
    }
    // Add new vote
    current[type]++;
    current.userVote = type;

    // Trigger animation
    showFloatingFeedback.value = type;
    setTimeout(() => {
      showFloatingFeedback.value = null;
    }, 1000);
  }

  feedbackStore.value = { ...feedbackStore.value }; // Trigger reactivity
};

const showFloatingFeedback = ref<"up" | "down" | null>(null);

const selectedPlace = ref<any>(null);
const isGenerating = ref(false);
const isGeneratingExtra = ref(false);
const isConvertingToSpeech = ref(false);
const isPlayingGuide = ref(false);
const generatedScript = ref("");
const generatedExtra = ref("");
const searchLogs = ref<any[]>([]);
const audioUrl = ref("");
const isAudioPlaying = ref(false);
const audioProgress = ref(0);
const audioPlayer = ref<HTMLAudioElement | null>(null);

// Loading State Messages
const loadingMessages = [
  {
    title: "Scouring records...",
    sub: "Filtering for specific dates and materials",
  },
  {
    title: "Consulting archives...",
    sub: "Verifying historical blueprints and masonry",
  },
  {
    title: "Mapping the site...",
    sub: "Calculating spatial orientation and viewpoints",
  },
  {
    title: "Fact-checking...",
    sub: "Comparing multiple sources for accuracy",
  },
  {
    title: "Analyzing facade...",
    sub: "Identifying specific architectural styles",
  },
  { title: "Retrieving legends...", sub: "Uncovering forgotten local stories" },
];
const currentLoadingIndex = ref(0);
const loadingInterval = ref<any>(null);

const startLoadingMessages = () => {
  currentLoadingIndex.value = 0;
  loadingInterval.value = setInterval(() => {
    currentLoadingIndex.value =
      (currentLoadingIndex.value + 1) % loadingMessages.length;
  }, 2500);
};

const stopLoadingMessages = () => {
  if (loadingInterval.value) {
    clearInterval(loadingInterval.value);
    loadingInterval.value = null;
  }
};

const currentLoadingMessage = computed(
  () => loadingMessages[currentLoadingIndex.value],
);

// Audio State Management
const activeAudioType = ref<"script" | "extra" | null>(null);

const toggleAudio = () => {
  if (!audioPlayer.value) return;
  if (isAudioPlaying.value) {
    audioPlayer.value.pause();
  } else {
    audioPlayer.value.play();
  }
};

const handleAudioMetadata = () => {
  isAudioPlaying.value = !audioPlayer.value?.paused;
};

const handleAudioTimeUpdate = () => {
  if (audioPlayer.value && audioPlayer.value.duration) {
    audioProgress.value =
      (audioPlayer.value.currentTime / audioPlayer.value.duration) * 100;
  }
};

const seekAudio = (e: MouseEvent) => {
  if (!audioPlayer.value || !audioPlayer.value.duration) return;

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const width = rect.width;
  const percentage = Math.max(0, Math.min(1, x / width));

  audioPlayer.value.currentTime = percentage * audioPlayer.value.duration;
  audioProgress.value = percentage * 100;
};

const handleAudioEnd = () => {
  isAudioPlaying.value = false;
  audioProgress.value = 0;
};

// Initialize
onMounted(async () => {
  isMounted.value = true;
  const { GridAlgorithm } = await import("@googlemaps/markerclusterer");
  clusterAlgorithm.value = new GridAlgorithm({ gridSize: 100 });
  if (!isSupported.value) {
    error.value = "Geolocation not supported by this browser.";
    return;
  }

  // Try to start automatically
  resume();

  // Center map once on startup when both map and position are ready
  const stopMapWatch = watch(
    [userPosition, () => mapRef.value?.map],
    ([pos, map]) => {
      if (pos && map) {
        setTimeout(() => {
          centerMap();
        }, 500);
        stopMapWatch(); // Only do this once on startup
      }
    },
    { immediate: true },
  );

  // Also trigger manual request to ensure prompt on mobile
  requestLocation();
});

watch(
  () => coords.value,
  (newCoords) => {
    if (newCoords && newCoords.latitude !== Infinity) {
      const pos = { lat: newCoords.latitude, lng: newCoords.longitude };
      userPosition.value = pos;
      if (places.value.length === 0 && !isFetchingPlaces.value) {
        mapCenter.value = pos;
        fetchPlaces();
      }
    }
  },
  { deep: true },
);

const centerMap = () => {
  if (userPosition.value && mapRef.value?.map) {
    const map = mapRef.value.map;
    const pos = { ...userPosition.value };

    // Calculate vertical offset to center in the top area
    // If sheet is expanded, top area is 40% of screen. Center of that is 20%.
    // Screen center is 50%. We need to pan 'up' by (50% - 20%) = 30% of map height.
    const offsetPercentage = isSheetCollapsed.value ? 0 : 0.3;
    const mapDiv = map.getDiv();
    const mapHeight = mapDiv.offsetHeight;
    const offsetPixels = mapHeight * offsetPercentage;

    map.setCenter(pos);
    map.setZoom(17);
    map.panBy(0, offsetPixels); // panBy(x, y) - positive y pans DOWN (moving map content down, view moves UP)
  }
};

const fetchPlaces = async () => {
  if (!userPosition.value) return;
  isFetchingPlaces.value = true;
  error.value = null;
  try {
    const { lat, lng } = userPosition.value;
    const res = await $fetch(
      `/api/places?lat=${lat}&lng=${lng}&radius=${currentRadius.value}&type=${currentCategory.value}`,
    );

    const newPlaces = (res as any).places;
    const existingIds = new Set(places.value.map((p) => p.id));
    const uniqueNewPlaces = newPlaces.filter(
      (p: any) => !existingIds.has(p.id),
    );

    places.value = [...places.value, ...uniqueNewPlaces];
  } catch (err: any) {
    error.value = err.message || "Failed to fetch places.";
  } finally {
    isFetchingPlaces.value = false;
  }
};

const setCategory = (id: string) => {
  currentCategory.value = id;
  if (filteredPlaces.value.length < 5) {
    fetchPlaces();
  }
};

const refreshScan = () => {
  currentRadius.value = 500;
  places.value = []; // Reset warehouse on hard refresh
  fetchPlaces();
};

const loadMore = () => {
  currentRadius.value += 1000;
  if (currentRadius.value > 10000) currentRadius.value = 10000;
  fetchPlaces();
};

const isCached = (id: string) => !!guideCache.value[id];
const isFavorite = (id: string) => favorites.value.some((f) => f.id === id);

const showFloatingHeart = ref(false);

const toggleFavorite = (place: any) => {
  if (!place) return;
  const index = favorites.value.findIndex((f) => f.id === place.id);
  if (index > -1) {
    favorites.value.splice(index, 1);
  } else {
    favorites.value.push({ ...place, ...(guideCache.value[place.id] || {}) });

    // Trigger micro-interaction
    showFloatingHeart.value = true;
    setTimeout(() => {
      showFloatingHeart.value = false;
    }, 1000);
  }
};

const openSavedGuide = (saved: any) => {
  selectedPlace.value = saved;
  generatedScript.value = saved.script || "";
  generatedExtra.value = saved.extra || "";
  searchLogs.value = saved.sources || [];
  audioUrl.value = saved.audioUrl || "";
  activeAudioType.value = saved.audioUrl ? "script" : null;
  isPlayingGuide.value = true;
  showFavorites.value = false;
};

const generateGuide = async (place: any, isDeepDive = false, force = false) => {
  if (isGenerating.value || isGeneratingExtra.value) return;
  if (!force && !isDeepDive && guideCache.value[place.id]) {
    openSavedGuide({ ...place, ...guideCache.value[place.id] });
    return;
  }
  selectedPlace.value = place;
  isPlayingGuide.value = true;

  if (isDeepDive) {
    isGeneratingExtra.value = true;
  } else {
    isGenerating.value = true;
    startLoadingMessages();
    generatedScript.value = "";
    generatedExtra.value = "";
    searchLogs.value = [];
    audioUrl.value = "";
    activeAudioType.value = null;
  }

  error.value = null;
  try {
    const res: any = await $fetch("/api/generate-guide", {
      method: "POST",
      body: {
        name: place.name,
        vicinity: place.vicinity,
        userLocation: {
          lat: userPosition.value?.lat,
          lng: userPosition.value?.lng,
        },
        placeLocation: place.location,
        deepDive: isDeepDive,
      },
    });

    if (isDeepDive) {
      generatedExtra.value = res.extra || "";
      // Append new sources if any
      const existingUrls = new Set(searchLogs.value.map((s) => s.url));
      const newSources = (res.sources || []).filter(
        (s: any) => !existingUrls.has(s.url),
      );
      searchLogs.value = [...searchLogs.value, ...newSources];
    } else {
      generatedScript.value = res.script;
      generatedExtra.value = res.extra || "";
      searchLogs.value = res.sources || [];
    }

    guideCache.value[place.id] = {
      ...(guideCache.value[place.id] || {}),
      script: generatedScript.value,
      extra: generatedExtra.value,
      sources: searchLogs.value,
      timestamp: Date.now(),
    };

    // Automatically trigger audio after generation
    if (!isDeepDive) {
      speakAloud("script");
    } else {
      speakAloud("extra");
    }
  } catch (err: any) {
    error.value = err.message || "Research failed.";
  } finally {
    isGenerating.value = false;
    isGeneratingExtra.value = false;
    stopLoadingMessages();
  }
};

const speakAloud = async (type: "script" | "extra" = "script") => {
  if (isConvertingToSpeech.value) return;

  // If this track is already active and loaded, toggle play/pause instead of reloading
  if (activeAudioType.value === type && audioUrl.value) {
    toggleAudio();
    return;
  }

  const textToSpeak =
    type === "script" ? generatedScript.value : generatedExtra.value;
  if (!textToSpeak) return;

  // Set active type immediately so UI shows pending state
  activeAudioType.value = type;

  const cacheKey = type === "script" ? "audioUrl" : "extraAudioUrl";

  if (
    selectedPlace.value &&
    guideCache.value[selectedPlace.value.id]?.[cacheKey]
  ) {
    audioUrl.value = guideCache.value[selectedPlace.value.id][cacheKey];
    return;
  }

  isConvertingToSpeech.value = true;
  error.value = null;
  try {
    const res: any = await $fetch("/api/text-to-speech", {
      method: "POST",
      body: { text: textToSpeak },
    });
    audioUrl.value = res.audioBase64;
    if (selectedPlace.value && guideCache.value[selectedPlace.value.id]) {
      guideCache.value[selectedPlace.value.id][cacheKey] = res.audioBase64;
    }
  } catch (err: any) {
    error.value = err.message || "TTS failed.";
    activeAudioType.value = null;
  } finally {
    isConvertingToSpeech.value = false;
  }
};

const closePlayer = () => {
  isPlayingGuide.value = false;
  if (audioPlayer.value) audioPlayer.value.pause();
  setTimeout(() => {
    audioUrl.value = "";
    generatedScript.value = "";
    generatedExtra.value = "";
    searchLogs.value = [];
    selectedPlace.value = null;
    activeAudioType.value = null;
    isAudioPlaying.value = false;
    audioProgress.value = 0;
  }, 500);
};
</script>

<style>
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap");
body {
  font-family: "Plus Jakarta Sans", sans-serif;
  overflow: hidden;
  overscroll-behavior: none;
  position: fixed;
  width: 100%;
  height: 100%;
}
.animate-in {
  animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
@keyframes slide-up {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.animate-float-up {
  animation: float-up 1s ease-out forwards;
}
@keyframes float-up {
  0% {
    transform: translate(-50%, 0) scale(0.5);
    opacity: 0;
  }
  20% {
    transform: translate(-50%, -20px) scale(1.2);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -60px) scale(1);
    opacity: 0;
  }
}

/* Simplified Loading Animations */
.animate-spin-slow {
  animation: spin 3s linear infinite;
}
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* Slide Fade Transition */
.slide-fade-enter-active {
  transition: all 0.4s ease-out;
}
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}
.slide-fade-enter-from {
  transform: translateY(10px);
  opacity: 0;
}
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.marker-label {
  margin-top: -10px;
  text-shadow:
    0 0 4px white,
    0 0 4px white,
    0 0 4px white;
}
</style>
