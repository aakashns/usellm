"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import useLLM, { OpenAIMessage } from "usellm";

function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.substring(1);
}

function Message({ role, content }: OpenAIMessage) {
  return (
    <div className="my-4">
      <div className="font-semibold text-gray-800">{capitalize(role)}</div>
      <div className="text-gray-600">{content}</div>
    </div>
  );
}

export default function DemoPage() {
  const [history, setHistory] = useState<OpenAIMessage[]>([]);
  const [inputText, setInputText] = useState("");

  const llm = useLLM({ serviceUrl: "/api/llm" });

  async function handleSend() {
    if (!inputText) {
      return;
    }

    const newHistory = [...history, { role: "user", content: inputText }];

    setHistory(newHistory);
    setInputText("");

    llm.chat({
      messages: newHistory,
      stream: true,
      onStream: ({ message }) => setHistory([...newHistory, message]),
    });
  }

  return (
    <div className="h-screen flex flex-col items-center">
      {history.length > 0 && (
        <div className="max-w-4xl w-full flex-1 overflow-y-auto px-4">
          {history.map((message, idx) => (
            <Message {...message} key={idx} />
          ))}
        </div>
      )}
      <div className="max-w-4xl w-full py-4 flex px-4">
        <Input
          type="text"
          placeholder="Enter message here"
          value={inputText}
          autoFocus
          onChange={(e) => setInputText(e.target.value)}
        />
        <Button variant="default" className="ml-2" onClick={handleSend}>
          Send
        </Button>
      </div>
    </div>
  );
}
