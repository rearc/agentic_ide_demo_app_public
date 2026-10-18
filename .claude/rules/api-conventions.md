# Flask API Conventions

All Flask API endpoints must use consistent response shapes and correct HTTP status codes, following Flask's documented patterns.

## Response Format

Return data directly — no wrapper envelope. Rely on HTTP status codes to indicate success or failure.

- **Single resource:** return the object directly via `jsonify(obj.to_dict())`
- **Collection:** return a bare list via `jsonify([obj.to_dict() for obj in items])`
- **Error:** return `{"error": "<message>"}` with the appropriate status code
- **Delete:** return an empty body with 204

## Status Codes

| Scenario | Code |
|----------|------|
| Success (with body) | 200 |
| Resource created | 201 |
| No content (delete) | 204 |
| Bad request / validation error | 400 |
| Unauthorized | 401 |
| Forbidden | 403 |
| Not found | 404 |
| Conflict (duplicate) | 409 |
| Server error | 500 |

## Examples

```python
# Single resource
@app.route("/api/widgets/<int:widget_id>")
def get_widget(widget_id):
    widget = db.get_or_404(Widget, widget_id)
    return jsonify(widget.to_dict())

# Collection
@app.route("/api/widgets")
def list_widgets():
    widgets = db.session.scalars(db.select(Widget)).all()
    return jsonify([w.to_dict() for w in widgets])

# Create
@app.route("/api/widgets", methods=["POST"])
def create_widget():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body is required"}), 400
    widget = Widget(**data)
    db.session.add(widget)
    db.session.commit()
    return jsonify(widget.to_dict()), 201

# Delete
@app.route("/api/widgets/<int:widget_id>", methods=["DELETE"])
def delete_widget(widget_id):
    widget = db.get_or_404(Widget, widget_id)
    db.session.delete(widget)
    db.session.commit()
    return "", 204

# BAD — wrapper envelope, don't do this
return jsonify({"data": widget.to_dict(), "error": None})

# BAD — returning a body on delete
return jsonify({"message": "Deleted"}), 200
```
