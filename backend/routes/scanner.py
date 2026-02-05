from flask import Blueprint, request, jsonify
import boto3
from models import db
from models.core import Scan