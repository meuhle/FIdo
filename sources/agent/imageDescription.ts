import { KnownModel, ollamaInference } from "../modules/ollama";
import { groqRequest } from "../modules/groq-llama3";
import { gptRequest } from "../modules/openai";


export async function imageDescription(src: Uint8Array, model: KnownModel = 'moondream:1.8b-v2-fp16'): Promise<string> {
    return ollamaInference({
        model: model,
        messages: [{
            role: 'system',
            content: 'You are a very advanced model and your task is to describe the image took from a dog prespective as precisely as possible. Consider that the name of the dog is Max. Transcribe any text you see.'
        }, {
            role: 'user',
            content: 'Describe the scene',
            images: [src],
        }]
    });
}

export async function llamaFind(question: string, images: string): Promise<string> {
    return groqRequest(
             `
                Process image descriptions captured from a dog's called Max point-of-view and respond to user inquiries. The user is Max owner.
                
                This are the provided images:
                ${images}

                DO NOT mention the images, scenes or descriptions in your answer, just answer the question.
                DO NOT try to generalize or provide possible scenarios.
                ONLY use the information in the description of the images to answer the question.
                BE concise and specific.
                DO reply in first person talking as you are actually Max while replying to the user.
            `

        ,
            question
    );
}

export async function openAIFind(question: string, images: string): Promise<string> {
    return gptRequest(
              `
        Process image descriptions captured from a dog's called Max point-of-view and respond to user inquiries. The user is Max owner.
        
        This are the provided images:
        ${images}

        DO NOT mention the images, scenes or descriptions in your answer, just answer the question.
        DO NOT try to generalize or provide possible scenarios.
        ONLY use the information in the description of the images to answer the question.
        BE concise and specific.
        DO reply in first person talking as you are actually Max while replying to the user.
    `

        ,
            question
    );
}