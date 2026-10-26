import {assignLot,addVariant,setExpiryWarningDays} from '../data/consumables.js';
import {repository} from '../data/store.js';
export async function handleConsumablesForm(form,refresh){
 const btn=form.querySelector('[type="submit"]');if(btn)btn.disabled=true;
 const out=document.getElementById('u11-error');if(out)out.hidden=true;
 try{const data=Object.fromEntries(new FormData(form).entries());
  if(form.id==='u11-lot-form')await assignLot(data);
  else if(form.id==='u11-warning-form')await setExpiryWarningDays(data.days);
  else if(form.id==='u11-variant-form'){
   const article=(await repository.articles()).find(x=>x.id===data.parentId);
   await addVariant(article,{packageSize:data.packageSize,packageUnit:data.packageUnit});
  }
  else return;
  const dialog=document.getElementById('catalog-details');if(dialog?.open)dialog.close();else dialog?.removeAttribute('open');
  await refresh();
 }catch(error){if(out){out.textContent=error.message||'Speichern fehlgeschlagen';out.hidden=false;}else alert(error.message||'Speichern fehlgeschlagen');}
 finally{if(btn)btn.disabled=false;}
}
