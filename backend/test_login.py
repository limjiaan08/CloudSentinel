import requests

url = "http://127.0.0.1:5000/api/auth/login"

payload = {
    "email": "test1@gmail.com",
    "password": "test1"
}

print(f"TESTING LOGIN FOR: {payload['email']}")

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")

    data = response.json()
    print("Response JSON:", data)

    if response.status_code == 200:
        print("\nSUCCESS")
        print(f"{data['user_name']}")
        print(f"Session ID: {data['session_id']}")
    else:
        print("\nLOGIN FAILED")
        print(f"Reason: {data.get('error')}")

except Exception as e:
    print(f"\nError: {e}")