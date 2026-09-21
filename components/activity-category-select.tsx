"use client"
import { useState } from "react"
import { CATEGORY_GROUPS, categoryGroup } from "@/lib/category-groups"
export function ActivityCategorySelect({categories,value,onChange,name,required=false}:{categories:{id:string;name:string;slug:string}[];value?:string;onChange?:(id:string)=>void;name?:string;required?:boolean}) {
 const [local,setLocal]=useState("")
 const [chosenGroup,setChosenGroup]=useState("")
 const selected=value ?? local
 const selectedCategory=categories.find(c=>c.id===selected)
 const group=selectedCategory ? categoryGroup(selectedCategory.slug)?.slug ?? "inne" : chosenGroup
 const groups=[...CATEGORY_GROUPS,{slug:"inne",name:"Inne atrakcje"}].filter(g=>categories.some(c=>(categoryGroup(c.slug)?.slug ?? "inne")===g.slug))
 const choose=(id:string)=>{setLocal(id);onChange?.(id)}
 return <div className="grid gap-4 sm:grid-cols-2">
 <label className="space-y-2 text-sm"><span className="font-medium">Kategoria główna</span><select className="h-11 w-full rounded-md border bg-background px-3" value={group} required={required} onChange={e=>{setChosenGroup(e.target.value);choose("")}}><option value="">Wybierz kategorię</option>{groups.map(g=><option key={g.slug} value={g.slug}>{g.name}</option>)}</select></label>
 <label className="space-y-2 text-sm"><span className="font-medium">Podkategoria / aktywność</span><select className="h-11 w-full rounded-md border bg-background px-3" name={name} value={selected} required={required} disabled={!group} onChange={e=>choose(e.target.value)}><option value="">Wybierz aktywność</option>{categories.filter(c=>(categoryGroup(c.slug)?.slug ?? "inne")===group).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 </div>
}
