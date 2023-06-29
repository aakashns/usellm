
"use client";
import { useState, ChangeEvent } from "react";
import useLLM from "usellm";

export default function ImageCaptioning() {
  const llm = useLLM({
    serviceUrl: "https://usellm.org/api/llm", // For testing only. Follow this guide to create your own service URL: https://usellm.org/docs/api-reference/create-llm-service
  });

  const [image, setImage] = useState<File | null>(null);
  const [result, setResult] = useState("");
  const version = 
    "2e1dddc8621f72155f24cf2e0adbde548458d3cab9f00c0139eea840d0ac4746";
  const timeoutValue = "10000";
  const [loading, setLoading] = useState("");

  async function handleClickCall() {
    setResult("");
    setLoading("Generating...");


    const reader = new FileReader();
    

    reader.onload = async () => {
      const imageData = reader.result as string;
      console.log(imageData);
      const response = await llm.callReplicate({
        version: version,
        input: { image: imageData },
        timeout: parseInt(timeoutValue),
      });
      console.log(response.output);
      setResult(response.output)
      setLoading("");
    };

    if (image) {
      reader.readAsDataURL(image);
    }
  }


  function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setImage(file || null);
  }

  return (
    <div className="p-4 overflow-y-auto">
      <h2 className="font-semibold text-2xl">Image Captioning</h2>

      <div className="flex my-4">
        <input
          className="p-2 border rounded mr-2 w-full dark:bg-gray-900 dark:text-white"
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
        />

        <button
          className="p-2 border rounded bg-gray-100 hover:bg-gray-200 active:bg-gray-300 dark:bg-white dark:text-black font-medium ml-2 "
          onClick={handleClickCall}
        >
          Generate
        </button>
      </div>        


    {image && (
      <div className="flex">
        <img
          src={URL.createObjectURL(image)}
          alt="Uploaded"
          style={{ maxWidth: "300px" }}
        />
      </div>
   )}       


        {loading && <div>{loading}</div>}


      {result && (
        <>
          <p
            style={{
              textAlign: "left",
              fontWeight: "bold",

            }}
          >
            {result.slice(8,)}
          </p>

        </>
      )}
    </div>
  )};