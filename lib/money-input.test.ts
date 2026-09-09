import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanMoneyInput,formatMoneyInput} from './money-input.ts';
test('金额分组不丢小数或正在输入的小数点',()=>{
 for(const [raw,display] of [['120000','120,000'],['1234567.80','1,234,567.80'],['1000.','1,000.'],['0.05','0.05'],['','']]){assert.equal(formatMoneyInput(raw),display);assert.equal(cleanMoneyInput(display),raw);}
});
test('粘贴支持全角和千位逗号，拒绝负数、指数、超出分的精度',()=>{
 assert.equal(cleanMoneyInput('１２３，４５６．７８'),'123456.78');assert.equal(cleanMoneyInput('.5'),'0.5');
 for(const raw of ['-12','1e6','12.345','12元','1.2.3'])assert.equal(cleanMoneyInput(raw),null);
});
