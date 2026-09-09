import {useEffect,useLayoutEffect,useRef,useState,type InputHTMLAttributes} from 'react';
import {cleanMoneyInput,formatMoneyInput} from '../lib/money-input';
type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'value'|'onChange'|'type'|'min'|'max'> & {value:string|number;onValueChange:(value:string)=>void;max?:number|string};
export default function MoneyInput({value,onValueChange,max,...props}:Props){
 const [raw,setRaw]=useState(String(value)),[focused,setFocused]=useState(false);
 const input=useRef<HTMLInputElement>(null),caret=useRef<number|null>(null);
 useEffect(()=>{if(!focused)setRaw(String(value));},[value,focused]);
 const display=formatMoneyInput(raw);
 useLayoutEffect(()=>{if(caret.current!==null&&input.current){let count=0,pos=0;while(pos<display.length&&count<caret.current){if(display[pos]!==',')count++;pos++;}input.current.setSelectionRange(pos,pos);caret.current=null;}},[display]);
 useEffect(()=>{input.current?.setCustomValidity(max!==undefined&&raw!==''&&Number(raw)>Number(max)?'金额不能大于 '+formatMoneyInput(String(max))+' 元':'');},[raw,max]);
 return <input {...props} ref={input} type="text" inputMode="decimal" className={`money-input ${props.className||''}`} pattern="[0-9,]+(\.[0-9]{0,2})?" value={display} onFocus={e=>{setFocused(true);props.onFocus?.(e);}} onBlur={e=>{setFocused(false);props.onBlur?.(e);}} onKeyDown={e=>{const el=e.currentTarget,p=el.selectionStart??0;if(el.selectionStart===el.selectionEnd){if(e.key==='Backspace'&&display[p-1]===',')el.setSelectionRange(Math.max(0,p-2),p);if(e.key==='Delete'&&display[p]===',')el.setSelectionRange(p,p+2);}props.onKeyDown?.(e);}} onChange={e=>{
  const next=cleanMoneyInput(e.target.value);if(next===null)return;
  caret.current=e.target.value.slice(0,e.target.selectionStart??e.target.value.length).replace(/[,，\s]/g,'').length;
  setRaw(next);onValueChange(next);
 }}/>
}
