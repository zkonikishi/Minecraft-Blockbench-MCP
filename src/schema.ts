// Run integrated tools on patched Zod 4 while retaining the upstream schemas'
// one-argument record spelling. Vendored sources remain byte-identical snapshots.
import {z as native} from 'zod/v4';

function record<V extends native.ZodType>(value:V):native.ZodRecord<native.ZodString,V>;
function record<K extends native.core.$ZodRecordKey,V extends native.ZodType>(key:K,value:V):native.ZodRecord<K,V>;
function record(key:native.ZodType,value?:native.ZodType){
 return value?native.record(key as native.core.$ZodRecordKey,value):native.record(native.string(),key);
}
export const z={...native,record};
export namespace z {
 export type ZodTypeAny=native.ZodType;
 export type ZodType<Output=unknown>=native.ZodType<Output>;
 export type ZodRawShape=native.ZodRawShape;
 export type ZodObject<T extends native.ZodRawShape=native.ZodRawShape>=native.ZodObject<T>;
 export type infer<T extends native.ZodType>=native.infer<T>;
}
