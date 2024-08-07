import * as React from 'react';
import { AsyncLock } from "../utils/lock";
import { imageDescription, llamaFind } from "./imageDescription";
import { startAudio } from '../modules/openai';

type Trigger_log={
    pic: string;
    trigger: string;
    
}

type AgentState = {
    lastDescription?: string;
    answer?: string;
    snakes?: string;
    snakesans?: string;
    loading: boolean;
    snaking: boolean;
    alert: boolean;
    log?: string[];
    trigger: string[];
    triggerstr?: string;
    triggered_pic?: [];
}

export class Agent {
    #lock = new AsyncLock();
    #photos: { photo: Uint8Array, description: string }[] = [];
    #state: AgentState = { loading: false,snaking:false,alert:false, trigger : ['Snakes']  };
    #stateCopy: AgentState = { loading: false,snaking:false,alert:false, trigger : ['Snakes'] };
    #stateListeners: (() => void)[] = [];

    async addPhoto(photos: Uint8Array[]) {
        await this.#lock.inLock(async () => {

            // Append photos
            let lastDescription: string | null = null;
            for (let p of photos) {
                console.log('Processing photo', p.length);
                let description = await imageDescription(p);
                console.log('Description', description);
                this.#photos.push({ photo: p, description });
                lastDescription = description;
            }

            // TODO: Update summaries

            // Update UI
            if (lastDescription) {
                this.#state.lastDescription = lastDescription;
                this.#notify();
            }
        });
    }

    async answer(question: string, snakes :boolean) {
        /* try {
             startAudio()
         } catch(error) {
             console.log("Failed to start audio")
         }*/
        
             
         
         if (snakes){
            if (this.#state.snaking) {
                return;
            }
            this.#state.snaking = true;
            this.#notify();
         }
         else{
            if (this.#state.loading) {
                return;
            }
            this.#state.loading = true;
             this.#notify();
         }
         
         
         await this.#lock.inLock(async () => {
             let combined = '';
             let i = 0;
             for (let p of this.#photos) {
                 combined + '\n\nImage #' + i + '\n\n';
                 combined += p.description;
                 i++;
             }
             let answer = await llamaFind(question, combined);
             if (snakes){
                this.#state.snakesans = answer;
                this.#state.snakes = undefined;
                let dateTime = new Date()
                 //this.#state.snakes = answer;
                 //ANSWER should be in the format of YES/NO. list of trigger separated by commas
                 if (typeof answer === "string" && answer.toLowerCase().indexOf('yes') != -1){                    
                    if( answer.indexOf('.') != -1){
                        let spl = answer.split('.');
                        this.#state.log?.push(dateTime.toString() + spl[1]);
                        //TODO add the log with pic reference
                        this.#state.snakes = spl[1];
                     }
                 }
                 
                 this.#state.snaking = false;
                 this.#notify();
                 //this.#state.snakes = answer;
                 
                 
             }else{
             this.#state.answer = answer;
             this.#state.loading = false;
             this.#notify();
             }
         });
     }

     addtrigger(trigger: string){
        const index = this.#state.trigger.indexOf(trigger);
        if (index>-1){
        this.#state.trigger.splice(index,1);
        }else{
            this.#state.trigger.push(trigger);
        }
        this.printtrigger()
     }
     returnTrigger(){
        return this.#state.trigger;
     }
     printtrigger(){
        this.#state.triggerstr = "";        
        var l = this.#state.trigger.length;
        for (var i=0; i<l;i++){
            this.#state.triggerstr += this.#state.trigger[i];
            if(i!=l-1){
                this.#state.triggerstr += ", ";
            }
        }
     }

    #notify = () => {
        this.#stateCopy = { ...this.#state };
        for (let l of this.#stateListeners) {
            l();
        }
    }


    use() {
        const [state, setState] = React.useState(this.#stateCopy);
        React.useEffect(() => {
            const listener = () => setState(this.#stateCopy);
            this.#stateListeners.push(listener);
            return () => {
                this.#stateListeners = this.#stateListeners.filter(l => l !== listener);
            }
        }, []);
        return state;
    }
}