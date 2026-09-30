from rest_framework.views import exception_handler
from rest_framework.response import Response


def drf_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        detail = response.data
        if isinstance(detail, dict):
            errors = {}
            for field, messages in detail.items():
                if isinstance(messages, list):
                    errors[field] = [str(m) for m in messages]
                else:
                    errors[field] = str(messages)
            response.data = {
                'success': False,
                'errors': errors,
            }
        elif isinstance(detail, list):
            response.data = {
                'success': False,
                'errors': {'non_field_errors': [str(d) for d in detail]},
            }
        else:
            response.data = {
                'success': False,
                'errors': {'detail': str(detail)},
            }

    return response
