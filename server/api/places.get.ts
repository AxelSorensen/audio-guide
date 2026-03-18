export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const lat = query.lat ? parseFloat(query.lat as string) : null
  const lng = query.lng ? parseFloat(query.lng as string) : null
  const radius = query.radius ? parseFloat(query.radius as string) : 500
  const typeFilter = query.type as string || 'all'

  if (!lat || !lng) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Latitude and Longitude are required',
    })
  }

  const config = useRuntimeConfig()
  const apiKey = config.public.googleMapsApiKey

  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Google Maps API key is not configured',
    })
  }

  try {
    const url = 'https://places.googleapis.com/v1/places:searchNearby'
    
    /**
     * Places API (New) strictly requires "Table A" types for searchNearby.
     * Table B types (like 'natural_feature', 'landmark') will cause 400 errors.
     */
    let includedTypes = [
      'tourist_attraction', 
      'museum', 
      'park', 
      'historical_landmark', 
      'cultural_center', 
      'art_gallery',
      'visitor_center'
    ]

    if (typeFilter === 'culture') {
      includedTypes = ['museum', 'art_gallery', 'cultural_center', 'library', 'performing_arts_theater']
    } else if (typeFilter === 'nature') {
      // 'hiking_area' and 'beach' are Table A. 'national_park' is Table A.
      includedTypes = ['park', 'hiking_area', 'beach', 'national_park', 'zoo', 'aquarium']
    } else if (typeFilter === 'history') {
      // 'historical_landmark' is the primary one. 'church' etc are Table A.
      includedTypes = ['historical_landmark', 'church', 'monument', 'castle', 'embassy']
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress,places.shortFormattedAddress,places.types,places.rating'
      },
      body: JSON.stringify({
        includedTypes,
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lng },
            radius: radius
          }
        }
      })
    })
    
    if (!response.ok) {
      const errorData = await response.json()
      console.error('Google Places API (New) Error:', JSON.stringify(errorData, null, 2))
      throw new Error(`Places API error: ${errorData?.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()

    if (!data.places) {
      return { places: [] }
    }

    // Map to the format the frontend expects
    return {
      places: data.places.map((p: any) => ({
        id: p.id,
        name: p.displayName?.text || 'Unknown Place',
        location: p.location ? { lat: p.location.latitude, lng: p.location.longitude } : null,
        vicinity: p.shortFormattedAddress || p.formattedAddress || '',
        types: p.types,
        rating: p.rating
      }))
    }
  } catch (error: any) {
    console.error('Error fetching places:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Internal Server Error',
    })
  }
})
