// sketch.js
const PUBLIC_KEY = '48d38e5123e31d7cb65ed60c78a07064';
const PRIVATE_KEY = '9414e432bb18cf61809af9bfc23d27862dd9b74e';
const BASE_URL = 'https://gateway.marvel.com/v1/public';
const CACHE_FILE = 'marvel_events_cache.json';

let events = [];
let nodes = [];
let links = [];
let dataLoaded = false;
let maxLinkStrength = 0;
let eventImages = {};
let rotationSpeed = 0.005;
let noiseOffset = 0;
let noiseStep = 0.005;
let myFont;

function preload() {
    myFont = loadFont('./Arial.ttf');
    // 檢查快取檔案是否存在
    loadJSON(CACHE_FILE, 
        // 成功：檔案存在，直接讀取
        handleCachedData,
        // 失敗：檔案不存在，呼叫 API
        handleNoCacheData
    );
}

function setup() {
    createCanvas(800, 600, WEBGL);
    textFont(myFont);
    noStroke();
}

// 處理快取檔案存在的情況
function handleCachedData(data) {
    console.log('Loading data from cache file');
    events = data;
    processVisualization();
}

// 處理快取檔案不存在的情況
async function handleNoCacheData() {
    console.log('Cache file not found, fetching from API...');
    await fetchFromAPI();
}

// 從 API 獲取數據
async function fetchFromAPI() {
    try {
        const timestamp = new Date().getTime();
        const hash = md5(timestamp + PRIVATE_KEY + PUBLIC_KEY);
        const url = `${BASE_URL}/events?ts=${timestamp}&apikey=${PUBLIC_KEY}&hash=${hash}&limit=20`;
        
        const response = await fetch(url);
        const data = await response.json();
        events = data.data.results;
        
        // 獲取每個事件的角色
        for (let event of events) {
            console.log(`Fetching characters for event: ${event.title}`);
            event.characters.items = await fetchEventCharacters(event.id, event.title);
            console.log(`Complete: ${event.title} has ${event.characters.items.length} characters`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 儲存到檔案
        saveJSON(events, CACHE_FILE);
        console.log('Data saved to cache file');
        
        // 處理視覺化
        processVisualization();
        
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// 獲取單個事件的角色
async function fetchEventCharacters(eventId, eventTitle) {
    const characters = [];
    let offset = 0;
    const limit = 50;
    
    try {
        // 先獲取總數
        const timestamp = new Date().getTime();
        const hash = md5(timestamp + PRIVATE_KEY + PUBLIC_KEY);
        const initialUrl = `${BASE_URL}/events/${eventId}/characters?ts=${timestamp}&apikey=${PUBLIC_KEY}&hash=${hash}&limit=1`;
        const initialResponse = await fetch(initialUrl);
        const initialData = await initialResponse.json();
        const total = initialData.data.total;
        
        if (total === 0) return [];
        
        while (characters.length < total) {
            const timestamp = new Date().getTime();
            const hash = md5(timestamp + PRIVATE_KEY + PUBLIC_KEY);
            const url = `${BASE_URL}/events/${eventId}/characters?ts=${timestamp}&apikey=${PUBLIC_KEY}&hash=${hash}&limit=${limit}&offset=${offset}`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data.code === 429) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                continue;
            }
            
            characters.push(...data.data.results.map(char => ({
                resourceURI: `http://gateway.marvel.com/v1/public/characters/${char.id}`,
                name: char.name
            })));
            
            offset += limit;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        console.error(`Error fetching characters for ${eventTitle}:`, error);
    }
    
    return characters;
}

// 處理視覺化相關的事情
// function processVisualization() {
//     console.log('Processing visualization...');
//     // 載入圖片
//     events.forEach(event => {
//         if (event.thumbnail && event.thumbnail.path && event.thumbnail.extension) {
//             const imageUrl = `${event.thumbnail.path}.${event.thumbnail.extension}`;
//             eventImages[event.id] = loadImage(imageUrl);
//         }
//     });
    
//     // 創建節點和連結
//     createNodesAndLinks();
//     dataLoaded = true;
// }
function processVisualization() {
  console.log('Processing visualization...');
  events.forEach(event => {
      if (event.thumbnail && event.thumbnail.path && event.thumbnail.extension) {
          let imageUrl = `${event.thumbnail.path}.${event.thumbnail.extension}`;
          imageUrl = imageUrl.replace('i.annihil.us', 'gateway.marvel.com');
          imageUrl = `${imageUrl}?apikey=${PUBLIC_KEY}`;
          
          loadImage(imageUrl, 
              img => {
                  eventImages[event.id] = img;
                  console.log('Image loaded successfully:', event.id);
              },
              err => {
                  console.error('Failed to load image:', event.id, err);
              }
          );
      }
  });
  
  createNodesAndLinks();
  dataLoaded = true;
}

// 以下是視覺化相關的函數，保持不變
function createNodesAndLinks() {
  const radius = 200;
  
  for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      const phi = Math.acos(1 - 2 * (i + 0.5) / events.length);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      
      print(`${event.title}: ${event.characters.items.length} characters`);
      
      nodes.push({
          id: event.id,
          title: event.title,
          x: x,
          y: y,
          z: z,
          characters: event.characters.items.map(char => char.resourceURI.split("/").pop()),
          size: map(event.characters.items.length, 0, 150, 10, 80), // 調整了大小係數，因為角色數量會變多
          color: color(50, 50, 125, 50)
      });
  }

  for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
          const shared = nodes[i].characters.filter(char => 
              nodes[j].characters.includes(char)
          );
          
          if (shared.length > 0) {
              links.push({
                  from: i,
                  to: j,
                  strength: shared.length
              });
              maxLinkStrength = Math.max(maxLinkStrength, shared.length);
          }
      }
  }
}

function draw() {
  // 使用 noise 來生成背景顏色
  let r = map(noise(noiseOffset), 0, 1, 20, 30);
  let g = map(noise(noiseOffset + 1000), 0, 1, 20, 30);
  let b = map(noise(noiseOffset + 2000), 0, 1, 0, 180);
  background(r, g, b);
  
  // 更新 noise offset
  noiseOffset += noiseStep;

  if (!dataLoaded) {
      push();
      translate(-width/4, 0, 0);
      fill(255);
      textSize(20);
      text('Loading Marvel Events...', 0, 0);
      pop();
      return;
  }
  rotateY(frameCount * rotationSpeed);

  ambientLight(80);
  orbitControl();

  // 為每個節點添加光源
  for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      pointLight(red(node.color), green(node.color), blue(node.color), node.x, node.y, node.z);
  }

  // 畫連結
  push();
  strokeWeight(1);
  for (let i = 0; i < links.length; i++) {
      const link = links[i];
      let from = nodes[link.from];
      let to = nodes[link.to];
      let alpha = map(link.strength, 1, maxLinkStrength, 100, 255);
      stroke(200, alpha);
      strokeWeight(map(link.strength, 1, maxLinkStrength, 0.1, 2));
      beginShape(LINES);
      vertex(from.x, from.y, from.z);
      vertex(to.x, to.y, to.z);
      endShape();
  }
  pop();

  // 畫節點球體
  nodes.forEach(node => {
      push();
      translate(node.x, node.y, node.z);
      
      if (eventImages[node.id]) {
          push();
          texture(eventImages[node.id]);
          sphere(node.size);
          pop();
      } else {
          push();
          ambientMaterial(node.color);
          sphere(node.size);
          pop();
      }

      push();
      fill(255);
      textAlign(CENTER, CENTER);
      textSize(12);
      text(node.title, 0, node.size + 5);
      pop();

      pop();
  });
}

function mouseDragged() {
  if (mouseX > pmouseX) {
    rotationY += 0.01;
  } else if (mouseX < pmouseX) {
    rotationY -= 0.01;
  }
}