// Decentralized Bluetooth/Wi-Fi Mesh Fallback
export const meshFallback = {
  broadcast: (msg: any) => console.log("Broadcasting via local mesh:", msg),
  listen: (callback: (msg: any) => void) => {
    // Mock mesh listener
    return () => {};
  }
};
