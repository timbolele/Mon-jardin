const DB_NAME='mon-jardin-db';
const DB_VERSION=1;
const STORE_NAME='garden';
const STATE_KEY='current';

function openDB(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)) return reject(new Error('IndexedDB indisponible'));
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

export async function loadGardenState(){
  try{
    const db=await openDB();
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readonly');
      const request=tx.objectStore(STORE_NAME).get(STATE_KEY);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error);
    });
  }catch(error){
    console.warn('IndexedDB indisponible, lecture locale de secours.',error);
    return null;
  }
}

export async function saveGardenState(state){
  const db=await openDB();
  return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_NAME,'readwrite');
    tx.objectStore(STORE_NAME).put(state,STATE_KEY);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}
