// The queue owns the request ID. Retries reuse it, even after a lost response.
export async function syncCommands({userId,list,send,remove,fail,onAccepted}) {
  let applied=0,failed=0,paused=false;
  for (const command of await list()) {
    if (command.userId!==userId || command.status==='failed') continue;
    try {
      const result=await send(command);
      if (result?.accepted!==true) throw Object.assign(new Error('The server did not confirm this change.'),{status:502});
      await onAccepted(result.item);
      await remove(command.operationId);
      applied++;
    } catch(error) {
      if (!error.status || error.status===401 || error.status===429 || error.status>=500) {paused=true;break;}
      await fail(command,error.message);failed++;
    }
  }
  return {applied,failed,paused};
}
