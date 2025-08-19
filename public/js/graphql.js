export async function fetchUserData(token) {
  try {
    // 1. If caller didn’t pass a token, try localStorage
    if (!token) {
      token = localStorage.getItem("authToken");
    }

    // 2. Still no token? Bail out early
    if (!token) {
      throw new Error("No authentication token provided. Please log in first.");
    }

    // 3. Trim BOM/whitespace off the token
    token = token.replace(/^\uFEFF/, "").trim();

    // 4. Load your GraphQL query text
    const queryRes = await fetch("/public/graphql/user.graphql");
    if (!queryRes.ok) {
      throw new Error("GraphQL query file not found");
    }
    const query = await queryRes.text();

    // 5. Fire the GraphQL request
    const res = await fetch(
      "https://learn.reboot01.com/api/graphql-engine/v1/graphql",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query }),
      }
    );

    if (!res.ok) {
      throw new Error("Failed to fetch data from GraphQL");
    }

    // 6. Parse and return the JSON payload
    const data = await res.json();
    console.log("GraphQL data:", data);
    return data;
  } catch (err) {
    console.error("fetchUserData error:", err);
    // Re-throw if you want callers to handle it too
    throw err;
  }
}
