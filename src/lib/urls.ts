export function itemUrl(id:string){
 const base=new URL(import.meta.env.BASE_URL,window.location.origin).href;
 return import.meta.env.VITE_GITHUB_PAGES==='true' ? base+'#/item/'+encodeURIComponent(id) : base+'item/'+encodeURIComponent(id);
}
