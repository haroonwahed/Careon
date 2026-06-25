type Props={theme?:"dark"|"light";compact?:boolean;className?:string};
export function CarelaneLogo({theme="dark",compact=false,className=""}:Props){
 const src=compact
  ?"/brand/logos/png/carelane-logo-compact-transparent.png"
  :theme==="dark"
   ?"/brand/logos/png/carelane-logo-gradient-white-transparent.png"
   :"/brand/logos/png/carelane-logo-navy-transparent.png";
 return <img src={src} alt="Carelane" className={className} draggable={false}/>;
}
