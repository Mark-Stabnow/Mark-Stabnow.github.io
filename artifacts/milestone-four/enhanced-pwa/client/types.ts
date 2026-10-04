export interface User {id:string;username:string;role:'manager'|'clerk'|'viewer'}
export interface Item {id:string;name:string;sku:string;quantity:number;reorderLevel:number;notes:string;location:string;category:string;version:number;archived:boolean;updatedAt:string}
export interface Command {operationId:string;userId:string;itemId:string;delta:number;reason:string;createdAt:number;status:'pending'|'failed';error?:string}
export interface Snapshot {user:User;items:Item[];savedAt:number;expiresAt:number}
export interface HistoryEntry {operationId:string;delta:number;balanceAfter:number;reason:string;createdAt:string;username:string}
