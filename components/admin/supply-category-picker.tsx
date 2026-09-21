"use client"
import { useState } from "react"
import { CATEGORY_GROUPS, categoryGroup } from "@/lib/category-groups"

type Category = {id:string;name:string;slug:string}
type Subcategory = {id:string;name:string;parent_category_id:string}
export function SupplyCategoryPicker({categories,subcategories,categoryId,subcategoryId}:{categories:Category[];subcategories:Subcategory[];categoryId?:string;subcategoryId?:string}) {
  const [activity,setActivity]=useState(categoryId ?? "")
  const [detail,setDetail]=useState(subcategoryId ?? "")
  const [group,setGroup]=useState(categoryGroup(categories.find(c=>c.id===categoryId)?.slug ?? "")?.slug ?? categoryGroup(categories[0]?.slug ?? "")?.slug ?? "inne")
  const choices=categories.filter(c=>(categoryGroup(c.slug)?.slug ?? "inne")===group)
  const details=subcategories.filter(s=>s.parent_category_id===activity)
  const style="h-10 w-full rounded-md border bg-background px-3 text-sm"
  return <div className="grid gap-4 md:col-span-2 xl:col-span-3 md:grid-cols-3">
    <label className="space-y-2 text-sm"><span className="font-medium">Kategoria główna</span><select className={style} value={group} onChange={e=>{setGroup(e.target.value);setActivity("");setDetail("")}}>
      {[...CATEGORY_GROUPS,{slug:"inne",name:"Inne atrakcje"}].filter(g=>categories.some(c=>(categoryGroup(c.slug)?.slug ?? "inne")===g.slug)).map(g=><option key={g.slug} value={g.slug}>{g.name}</option>)}
    </select></label>
    <label className="space-y-2 text-sm"><span className="font-medium">Podkategoria / aktywność</span><select name="category_id" className={style} value={activity} onChange={e=>{setActivity(e.target.value);setDetail("")}}><option value="">Wybierz aktywność</option>{choices.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    {details.length>0 ? <label className="space-y-2 text-sm"><span className="font-medium">Dodatkowy rodzaj aktywności</span><select name="subcategory_id" className={style} value={detail} onChange={e=>setDetail(e.target.value)}><option value="">Nie wybrano</option>{details.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label> : <input type="hidden" name="subcategory_id" value="" />}
  </div>
}
