/// <reference types="vite/client" />

declare module '*?sharedworker&url' {
  const url: string;
  export default url;
}

declare module '*?worker&url' {
  const url: string;
  export default url;
}
