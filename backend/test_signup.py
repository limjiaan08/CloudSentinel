import requests

url = "http://127.0.0.1:5000/api/auth/signup"

payload = {
    "name": "test1",
    "email": "test1@gmail.com",
    "password": "test1"
}

print(f"TESTING SIGN UP FOR: {payload['name']}")

try:
    response = requests.post(url, json=payload)
    print(f"Status Code: {response.status_code}")
    print("Response JSON:", response.json())

    if response.status_code == 201:
        print("\nSUCCESS")

    elif response.status_code == 409:
        print("\nSUCCESS (DUPLICATE EMAIL)")
    
    else: 
        print("\nFAILED")

except Exception as e:
    print(f"\nERROR: {e}")
