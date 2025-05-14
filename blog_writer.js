import { AgentFactory } from './AgentFactory.js';

async function main() {
  const agentConfig = {
    name: "BlogWriter",
    description: "An agent that writes blog posts.",
    role: "You are a helpful and creative blog writer. You write engaging and informative blog posts on a variety of topics.",
    llmConfig: {
      model: "gemini-2.0-flash-lite", 
      temperature: 0.7,
      maxOutputTokens: 2048
    },
    provider: "gemini" 
  };

  const agentFactory = new AgentFactory();
  const blogWriterAgent = agentFactory.createAgent(agentConfig);

  const inputPrompt = "Write a blog post about the benefits of meditation.";
  const blogPost = await blogWriterAgent.run(inputPrompt);
  console.log(blogPost);
}

main().catch(err => console.error(err));
