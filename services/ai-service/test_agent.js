import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicTool } from "@langchain/core/tools";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { createToolCallingAgent, AgentExecutor } from "@langchain/classic/agents";
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

const model = new ChatGoogleGenerativeAI({
    apiKey,
    model: "gemini-2.5-flash-lite",
    streaming: true,
    maxOutputTokens: 2048,
    apiVersion: "v1beta"
});

const tools = [
    new DynamicTool({
        name: "search_sri_lankan_law",
        description: "Search for specific Sri Lankan legal acts, sections, and case law from the official database. Use this for grounding legal claims.",
        func: async (query) => {
            return "Mock law result.";
        }
    }),
    new DynamicTool({
        name: "get_current_trial_transcript",
        description: "Retrieve the latest transcript messages from the ACTIVE session. Call this to see what arguments were made during the trial.",
        func: async () => {
             return "Mock transcript result.";
        }
    })
];

const SYSTEM_INSTRUCTION = `You are a Senior Sri Lankan Legal AI Agent for the LAWNOVA platform.`;

const promptTemplate = ChatPromptTemplate.fromMessages([
    ["system", SYSTEM_INSTRUCTION],
    new MessagesPlaceholder("chat_history"),
    ["user", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
]);

const agent = createToolCallingAgent({
    llm: model,
    tools,
    prompt: promptTemplate,
});

const executor = new AgentExecutor({
    agent,
    tools,
    verbose: true,
});

async function testAgent() {
    try {
        console.log("Starting agent...");
        const result = await executor.invoke({
            input: "What is theft?",
            chat_history: []
        });
        console.log("Agent Result:", result.output);
    } catch (error) {
        console.error("Agent Error:", error.message);
        if (error.stack) console.error(error.stack);
    }
}

testAgent();
