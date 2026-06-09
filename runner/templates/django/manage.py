import os
import sys
from django.conf import settings
from django.core.wsgi import get_wsgi_application
from django.http import HttpResponse
from django.urls import path

settings.configure(
    DEBUG=True,
    SECRET_KEY="yuvro_secret_key_12345",
    ROOT_URLCONF=__name__,
    ALLOWED_HOSTS=["*"],
)

def home(request):
    return HttpResponse("Hello from Django in your Yuvro REPL!")

urlpatterns = [
    path("", home),
]

application = get_wsgi_application()

if __name__ == "__main__":
    from django.core.management import execute_from_command_line
    args = sys.argv
    if len(args) == 1:
        args = args + ["runserver", "0.0.0.0:8000"]
    execute_from_command_line(args)
