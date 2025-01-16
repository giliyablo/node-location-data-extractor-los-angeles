const axios = require('axios');
const fs = require('fs');
const Populartimes = require('@christophern/populartimesjs').Populartimes;

require('dotenv').config();

const API_KEY = process.env.GOOGLE_API_KEY;

// Function to fetch places using Text Search with pagination
async function fetchPlaces(query, pagetoken = '') {
  let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${API_KEY}`;
  if (pagetoken) {
    url += `&pagetoken=${pagetoken}`;
  }
  const response = await axios.get(url);
  return response.data;
}

// Function to fetch place details (opening hours, popular times)
async function getPlaceDetails(place_id) {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&key=${API_KEY}`;
  const response = await axios.get(url);
  return response.data.result;
}

// Function to process a single area (neighborhood or zip code)
async function processArea(areaName) {
  const csvData = [];
  csvData.push([
    'Name', 'Address', 'Latitude', 'Longitude', 
    'Opening Hours', 'Popular Times', 
    'Secondary Opening Hours', 'Open Now',
    'Current Opening Hours'
  ]);

  let nextPageToken = '';
  do {
    const query = `places in ${areaName}, Los Angeles`; 
    const data = await fetchPlaces(query, nextPageToken);

    const populartimes = new Populartimes();

    for (const place of data.results) {
      try {
        const details = await getPlaceDetails(place.place_id);

        let popularTimesData = "N/A";
        populartimes.fullWeek(place.place_id).then((data) => {
          popularTimesData = data;
          console.log('🚀', data);
        });

        let openingHours = "N/A";
        if (details.opening_hours && details.opening_hours.weekday_text) {
          openingHours = details.opening_hours.weekday_text.join('; ');
        }

        let secondaryOpeningHours = "N/A";
        if (details.opening_hours && details.opening_hours.periods && 
            details.opening_hours.periods.length > 1) { 
          secondaryOpeningHours = details.opening_hours.periods[1].open.day.toString() + 
                                 " " + details.opening_hours.periods[1].open.time + 
                                 " - " + details.opening_hours.periods[1].close.time;
        }

        let openNow = "N/A";
        if (details.opening_hours) {
          openNow = details.opening_hours.open_now ? "Yes" : "No"; 
        }

        // Extract current opening hours
        let currentOpeningHours = "N/A";
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 (Sunday) to 6 (Saturday)
        if (details.opening_hours && details.opening_hours.periods) {
          const periods = details.opening_hours.periods;
          for (const period of periods) {
            if (period.open.day === dayOfWeek) {
              currentOpeningHours = `${period.open.time} - ${period.close.time}`;
              break;
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching details for ${place.name}:`, error);
      } finally {
        csvData.push([
          place.name,
          place.formatted_address,
          place.geometry.location.lat,
          place.geometry.location.lng,
          openingHours,
          popularTimesData,
          secondaryOpeningHours,
          openNow,
          currentOpeningHours
        ]);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    nextPageToken = data.next_page_token;
    await new Promise(resolve => setTimeout(resolve, 2000));

  } while (nextPageToken);

  const csvContent = csvData.map(row => row.join(',')).join('\n');
  fs.writeFileSync(`${areaName}_places.csv`, csvContent, 'utf8');
  console.log(`CSV file created for ${areaName}!`);
}

async function savePlacesToCsv() {
  const areas = [
    "Eaton", "Hurst", "Palisades"
    // ... Add more areas here ...
  ];

  for (const area of areas) {
    await processArea(area);
  }
}

savePlacesToCsv().catch(err => console.error(err));
