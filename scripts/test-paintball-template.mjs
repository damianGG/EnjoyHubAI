import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
const require = createRequire(import.meta.url)
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const ts = require('typescript')
const React = require('react')
const {renderToStaticMarkup} = require('react-dom/server')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..')
function load(file) {
 const mod={exports:{}}
 const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText
 vm.runInNewContext(code,{exports:mod.exports,require:name=>name.startsWith('@/') ? load(name.slice(2)+'.ts') : require(name),console,URL,URLSearchParams})
 return mod.exports
}
const {PaintballProfile}=load('components/paintball/paintball-profile.tsx')
const empty=renderToStaticMarkup(React.createElement(PaintballProfile,{online:false,data:{facts:{},packages:[]}}))
assert.match(empty,/Zapytaj organizatora/)
assert.match(empty,/Ustal pakiet dla swojej grupy/)
assert.doesNotMatch(empty,/500 szt.|od 7 lat|100 zł/)
const full=renderToStaticMarkup(React.createElement(PaintballProfile,{online:true,data:{facts:{field_count:2,parking_available:true,terrain_forest:false},packages:[{id:'p',name:'Pakiet testowy',duration:90,minPlayers:6,maxPlayers:12,minAge:16,balls:500,includes:['Maska'],pricingModel:'per_person',tickets:[{name:'Uczestnik',price:120,currency:'PLN'}]}]}}))
for(const fragment of ['16 lat','500 szt.','90 min','6–12 os.','Parking','Maska','Pakiet testowy','Cena za osobę']) assert.ok(full.includes(fragment),fragment)
assert.ok(!full.includes('Pole leśne'))
const {publicAttractionPath}=load('lib/marketplace/attraction-path.ts')
const {extractPublicAttractionCode,getAttractionPublicCode}=load('lib/utils.ts')
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const href=publicAttractionPath({id,title:'Paintball & las',city:'Rzeszów',property_type:'attraction'})
assert.ok(href.startsWith('/atrakcja/'))
assert.ok(!href.includes(id))
assert.equal(extractPublicAttractionCode(href.split('/').pop()),getAttractionPublicCode(id))
const {buildCategoryCatalog}=load('lib/categories/catalog.ts')
const catalog=buildCategoryCatalog(
  [
    {id:'adrenalina',name:'Adrenalina',slug:'adrenalina'},
    {id:'rodzina',name:'Dzieci i rodzina',slug:'dzieci-i-rodzina'},
  ],
  [
    {id:'paintball',parent_category_id:'adrenalina',name:'Paintball',slug:'paintball'},
    {id:'gokarty',parent_category_id:'adrenalina',name:'Gokarty',slug:'go-karts'},
    {id:'dmuchance',parent_category_id:'rodzina',name:'Dmuchańce',slug:'dmuchance'},
  ],
)
assert.deepEqual(catalog.find(item=>item.slug==='adrenalina').subcategories.map(item=>item.slug),['go-karts','paintball'])
assert.deepEqual(catalog.find(item=>item.slug==='dzieci-i-rodzina').subcategories.map(item=>item.slug),['dmuchance'])
console.log('Paintball template: content, missing data, canonical taxonomy and map route PASS')
