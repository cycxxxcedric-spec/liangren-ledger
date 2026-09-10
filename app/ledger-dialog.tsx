'use client';
import * as React from 'react';
import {Dialog as Primitive} from '@base-ui/react/dialog';
import {AlertDialog as AlertPrimitive} from '@base-ui/react/alert-dialog';
import {X} from 'lucide-react';
export {Dialog,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
export {AlertDialog,AlertDialogTitle,AlertDialogDescription} from '@/components/ui/alert-dialog';
// Own the positioning instead of combining mobile geometry with centered utility transforms.
export function DialogContent({className='',children,feedback,...props}:Primitive.Popup.Props & {feedback?:string}){
 return <Primitive.Portal><Primitive.Backdrop className="ledger-backdrop"/><Primitive.Popup {...props} className={`ledger-surface ${className}`}><div className="ledger-surface-body">{feedback&&<p role="alert" className="form-tip">{feedback}</p>}{children}</div><Primitive.Close className="ledger-surface-close" aria-label="关闭"><X size={22}/></Primitive.Close></Primitive.Popup></Primitive.Portal>;
}
export function AlertDialogContent({className='',children,...props}:AlertPrimitive.Popup.Props){
 return <AlertPrimitive.Portal><AlertPrimitive.Backdrop className="ledger-backdrop"/><AlertPrimitive.Popup {...props} className={`ledger-surface ${className}`}><div className="ledger-surface-body">{children}</div></AlertPrimitive.Popup></AlertPrimitive.Portal>;
}
