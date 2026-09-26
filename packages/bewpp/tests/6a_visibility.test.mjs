import test from 'node:test'
import assert from 'node:assert/strict'
import { ExtensionPage } from '../dist/index.js'

test('isVisible resolves once for absent, visible, hidden and fallback locators', async () => {
 const results=[]
 for (const scenario of [
  {installed:true,count:0,visible:false},
  {installed:true,count:1,visible:true},
  {installed:true,count:1,visible:false},
  {installed:false,count:0,visible:false},
 ]) {
  const events=[]
  const page=new ExtensionPage(1,{
   resolveWithSelectorEngine:async()=>{events.push('resolve');return {...scenario,marker:'test-marker'}},
   execute:async(_id,command)=>{events.push({action:command.action,query:command.query});return scenario.visible},
  },()=>[{id:1,url:'https://example.test',title:'fixture',active:false}])
  results.push({visible:await page.locator('#panel').isVisible({timeout:100}),events})
 }
 assert.deepEqual(results,[
  {visible:false,events:['resolve']},
  {visible:true,events:['resolve',{action:'visible',query:{marker:'test-marker'}}]},
  {visible:false,events:['resolve',{action:'visible',query:{marker:'test-marker'}}]},
  {visible:false,events:['resolve',{action:'visible',query:{selector:'#panel'}}]},
 ])
})
