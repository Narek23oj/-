export async function askOpenAI(prompt: string): Promise<string> {
  try {
    const response = await fetch("/api/ai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to get response from OpenAI");
    }

    const data = await response.json();
    return data.result;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
}
