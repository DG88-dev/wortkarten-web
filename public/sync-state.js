// Field-level patches preserve edits to the other flag made on another device.
export function overlay(remote,pending) {
  const merged={...remote};
  for(const [id,fields] of Object.entries(pending)){
    merged[id]={favorite:false,hidden:false,...merged[id]};
    for(const [field,operation] of Object.entries(fields))merged[id][field]=operation.value;
  }
  return merged;
}
export function acknowledge(pending,sent) {
  const remaining=structuredClone(pending);
  for(const [id,fields] of Object.entries(sent)){
    for(const [field,op] of Object.entries(fields))if(remaining[id]?.[field]?.token===op.token)delete remaining[id][field];
    if(remaining[id]&&!Object.keys(remaining[id]).length)delete remaining[id];
  }
  return remaining;
}
