import fs from 'fs';
import piexif from 'piexifjs';
import { execSync } from 'child_process';

const locations = {
    "france_paris": [48.8584, 2.2945],
    "italy_rome": [41.8902, 12.4922],
    "japan_mtfuji": [35.3606, 138.7274],
    "usa_nyc": [40.6892, -74.0445],
    "china_beijing": [40.4319, 116.5704],
    "peru_machupicchu": [-13.1631, -72.5450],
    "india_agra": [27.1751, 78.0421],
    "egypt_giza": [29.9792, 31.1342],
    "australia_sydney": [-33.8568, 151.2153],
    "brazil_rio": [-22.9519, -43.2105],
    "greece_santorini": [36.4618, 25.3753],
    "jordan_petra": [30.3285, 35.4444],
    "cambodia_angkor": [13.4125, 103.8670],
    "canada_banff": [51.4254, -116.1773],
    "southafrica_capetown": [-33.9628, 18.4098],
    "tanzania_serengeti": [-2.3333, 34.8333],
    "uk_london": [51.5033, -0.1195],
    "spain_barcelona": [41.4036, 2.1744],
    "russia_moscow": [55.7525, 37.6231],
    "uae_dubai": [25.1972, 55.2744],

    "germany_neuschwanstein": [47.5576, 10.7498],
    "chile_easter_island": [-27.1127, -109.3497],
    "turkey_cappadocia": [38.6431, 34.8303],
    "iceland_blue_lagoon": [63.8804, -22.4495],
    "thailand_grand_palace": [13.7500, 100.4913],
    "argentina_iguazu": [-25.6953, -54.4367],
    "maldives_resort": [4.1755, 73.5093],
    "mexico_chichen_itza": [20.6843, -88.5678],
    "indonesia_bali": [-8.4095, 115.1889],
    "morocco_chefchaouen": [35.1716, -5.2697],
    "newzealand_hobbiton": [-37.8720, 175.6829],
    "switzerland_matterhorn": [45.9763, 7.6583],
    "vietnam_halong_bay": [20.9101, 107.1839],
    "scotland_edinburgh": [55.9486, -3.1999],
    "portugal_sintra": [38.7876, -9.3906],
    "croatia_dubrovnik": [42.6507, 18.0944],
    "netherlands_amsterdam": [52.3676, 4.9041],
    "myanmar_bagan": [21.1717, 94.8585],
    "kenya_masai_mara": [-1.4900, 35.1439],
    "ecuador_galapagos": [-0.9538, -90.9656],
    "norway_fjords": [62.1015, 7.0941],
    "czech_prague": [50.0865, 14.4114],
    "austria_vienna": [48.1849, 16.3122],
    "belgium_bruges": [51.2093, 3.2247],
    "sweden_stockholm": [59.3251, 18.0711],

    "finland_lapland": [67.9222, 26.5046],
    "denmark_copenhagen": [55.6802, 12.5905],
    "ireland_cliffs_of_moher": [52.9715, -9.4265],
    "poland_krakow": [50.0614, 19.9372],
    "hungary_budapest": [47.5071, 19.0456],
    "malaysia_kuala_lumpur": [3.1578, 101.7115],
    "singapore_marina_bay": [1.2836, 103.8590],
    "southkorea_seoul": [37.5796, 126.9770],
    "taiwan_taipei": [25.0336, 121.5644],
    "philippines_palawan": [11.1819, 119.3900],
    "nepal_everest": [27.9861, 86.9226],
    "bhutan_tigers_nest": [27.4919, 89.3635],
    "srilanka_sigiriya": [7.9570, 80.7603],
    "madagascar_baobab": [-20.2510, 44.4184],
    "botswana_okavango": [-19.2882, 22.8620],
    "namibia_sossusvlei": [-24.7275, 15.3340],
    "zimbabwe_victoria_falls": [-17.9243, 25.8572],
    "senegal_gorees_island": [14.6672, -17.3986],
    "colombia_cartagena": [10.3997, -75.5144],
    "bolivia_uyuni": [-20.1338, -67.6253],
    "costarica_arenal": [10.4632, -84.7032],
    "cuba_havana": [23.1136, -82.3666],
    "jamaica_negril": [18.3114, -78.3387],
    "bahamas_exuma": [23.6300, -75.9234],
    "panama_canal": [9.0800, -79.6801]
};

function toDeg(value) {
    const d = Math.floor(value);
    const m = Math.floor((value - d) * 60);
    const s = Math.round((value - d - m / 60) * 3600 * 100);
    return [[d, 1], [m, 1], [s, 100]];
}

const baseDir = "/Users/amithcabraal/.gemini/antigravity/brain/b54f5a01-e4ce-46cc-ba3b-b3e3f9b4c76a";
const targetDir = "/Users/amithcabraal/code/personal/pic-machina/app/test_data";

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const files = fs.readdirSync(baseDir);

for (const [prefix, [lat, lon]] of Object.entries(locations)) {
    const pngFile = files.find(f => f.startsWith(prefix + "_") && f.endsWith(".png"));
    if (!pngFile) {
        console.log("Missing:", prefix);
        continue;
    }
    const pngPath = `${baseDir}/${pngFile}`;
    const jpgPath = `${targetDir}/${prefix}.jpg`;
    
    try {
        // Convert to JPG using sips (macOS built-in)
        execSync(`sips -s format jpeg "${pngPath}" --out "${jpgPath}" > /dev/null 2>&1`);
        
        // Add EXIF
        const latDeg = toDeg(Math.abs(lat));
        const latRef = lat >= 0 ? "N" : "S";
        const lonDeg = toDeg(Math.abs(lon));
        const lonRef = lon >= 0 ? "E" : "W";
        
        const gpsIfd = {};
        gpsIfd[piexif.GPSIFD.GPSLatitudeRef] = latRef;
        gpsIfd[piexif.GPSIFD.GPSLatitude] = latDeg;
        gpsIfd[piexif.GPSIFD.GPSLongitudeRef] = lonRef;
        gpsIfd[piexif.GPSIFD.GPSLongitude] = lonDeg;
        
        const exifObj = { "GPS": gpsIfd };
        const exifBytes = piexif.dump(exifObj);
        
        const jpegData = fs.readFileSync(jpgPath);
        const dataStr = jpegData.toString("binary");
        const newDataStr = piexif.insert(exifBytes, dataStr);
        const newJpegData = Buffer.from(newDataStr, "binary");
        
        fs.writeFileSync(jpgPath, newJpegData);
        console.log(`Processed ${prefix} to ${jpgPath}`);
    } catch (err) {
        console.error(`Error on ${prefix}:`, err.message);
    }
}
