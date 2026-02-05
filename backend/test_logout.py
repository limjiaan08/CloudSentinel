import requests
import time

login_url = "http://127.0.0.1:5000/api/auth/login"
credentials = {"email": "test1@gmail.com", "password": "test1"}

print("LOGGING IN")
response = requests.post(login_url, json=credentials)
session_id = response.json().get('session_id')

if session_id:
    print(f"Success! Session ID: {session_id}")

    time.sleep(5)

    print("\nLOGGING OUT")
    logout_url = "http://127.0.0.1:5000/api/auth/logout"
    logout_response = requests.post(logout_url, json={"session_id": session_id})

    print(f"Status: {logout_response.status_code}")
    print(f"Response: {logout_response.json()}")