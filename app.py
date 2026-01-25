#!/usr/bin/python
# -!- coding: utf-8 -!-

from functools import wraps
from flask import Flask, request, redirect, render_template, make_response, send_from_directory, jsonify
import os
from werkzeug.utils import secure_filename
import uuid

import config
from services.shopping_lists import ShoppingLists
from decorators.css_class import CSSClassDecorator

app = Flask(__name__)

app.config['MAX_CONTENT_LENGTH'] = int(config.MAX_FILE_SIZE_MB * 1024 * 1024)


def item_sort_function(item):
    return int(item[1])


def authenticated(func):
    @wraps(func)
    def wrapped_f(*args, **kwds):
        can_pass = False
        if config.COOKIE_KEY in request.cookies:
            can_pass = request.cookies[config.COOKIE_KEY] == config.COOKIE_PASS

        if can_pass:
            return func(*args, **kwds)
        else:
            return redirect("{}login".format(config.BASE_URL_PATH), code=302)
    return wrapped_f


@app.route("/", methods=["GET"])
@authenticated
def lists():
    shopping_lists = ShoppingLists(config)
    all_lists = shopping_lists.get_all_lists()
    lists_with_mode = [
        (
            list_name,
            shopping_lists.is_multi_line_list(list_name),
            shopping_lists.unprefixed_list_name(list_name, shopping_lists.is_multi_line_list(list_name)),
        ) for list_name in all_lists
    ]
    return render_template("lists.html", lists=lists_with_mode, base_url_path=config.BASE_URL_PATH)


@app.route("/items/<list_name>", methods=["GET", "POST"])
@authenticated
def list_items(list_name):
    shopping_lists = ShoppingLists(config)
    if request.method == "POST":
        form_data = [key for key in request.form.keys()]
        action, item_name = form_data[0].split(config.SEPARATOR) if form_data else (None, None)

        # Handle file deletion when item is removed (action "d")
        if action == "d" and item_name and item_name.startswith("file://"):
            # Parse file reference: file://<fileId>::<originalName>::<mimeType>
            file_content = item_name[7:]

            # Handle both :: and | separators
            if "::" in file_content:
                file_id = file_content.split("::")[0]
            else:
                file_content = file_content.replace("&#124;", "|")
                file_id = file_content.split("|")[0]

            if config.MULTI_LINE_FILE_UPLOAD and file_id:
                files_dir = os.path.join(config.LISTS_FOLDER, f"{list_name}_files")
                safe_file_id = secure_filename(file_id)
                if safe_file_id == file_id:
                    file_path = os.path.join(files_dir, file_id)
                    if os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except Exception as e:
                            print(f"Warning: Failed to delete file {file_path}: {e}")
                    else:
                        print(f"Warning: File {file_path} does not exist for deletion.")
                else:
                    print(f"Warning: Unsafe file ID detected: {file_id}")

        shopping_lists.save_list_item_action(list_name, item_name, action)
        return "", 204
    else:
        new_item_located_at_top = config.NEW_ITEM_LOCATION == "top"
        items = CSSClassDecorator.decorate_items(shopping_lists.get_items(list_name))
        order_by = request.args.get("order_by")
        if order_by == "state":
            items = sorted(items, key=item_sort_function, reverse=True)

        multi_line_mode = shopping_lists.is_multi_line_list(list_name)
        unprefixed_name = shopping_lists.unprefixed_list_name(list_name, multi_line_mode)

        return render_template(
            "items.html",
            list_name=list_name,
            unprefixed_name=unprefixed_name,
            items=items,
            base_url_path=config.BASE_URL_PATH,
            separator=config.SEPARATOR,
            new_item_located_at_top=new_item_located_at_top,
            multi_line_mode=multi_line_mode,
            multi_line_file_upload=config.MULTI_LINE_FILE_UPLOAD,
            max_file_size_mb=config.MAX_FILE_SIZE_MB,
        )


@app.route("/upload-file/<list_name>", methods=["POST"])
@authenticated
def upload_file(list_name):
    if not config.MULTI_LINE_FILE_UPLOAD:
        return jsonify({"error": "File upload disabled"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    files_dir = os.path.join(config.LISTS_FOLDER, f"{list_name}_files")
    os.makedirs(files_dir, exist_ok=True)

    original_filename = secure_filename(file.filename)
    file_ext = os.path.splitext(original_filename)[1]
    unique_id = str(uuid.uuid4())
    stored_filename = f"{unique_id}{file_ext}"

    file_path = os.path.join(files_dir, stored_filename)
    file.save(file_path)

    mime_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".pdf": "application/pdf",
        ".txt": "text/plain",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".zip": "application/zip",
        ".md": "text/markdown",
    }
    mime_type = mime_types.get(file_ext.lower(), 'application/octet-stream')

    return jsonify({
        "fileId": stored_filename,
        "originalName": original_filename,
        "mimeType": mime_type
    }), 200


@app.route("/download-file/<list_name>/<file_id>", methods=["GET"])
@authenticated
def download_file(list_name, file_id):
    if not config.MULTI_LINE_FILE_UPLOAD:
        return "File download disabled", 403

    files_dir = os.path.join(config.LISTS_FOLDER, f"{list_name}_files")

    safe_file_id = secure_filename(file_id)
    if safe_file_id != file_id:
        return "Invalid file ID", 400

    file_path = os.path.join(files_dir, file_id)
    if not os.path.exists(file_path):
        return "File not found", 404

    requested_name = request.args.get("filename")
    if requested_name:
        original_name = secure_filename(requested_name) or file_id
    else:
        original_name = file_id

    return send_from_directory(files_dir, file_id, download_name=original_name)


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        if request.form.get("pass") == config.PASS:
            response = make_response(redirect(config.BASE_URL_PATH, code=302))
            # 1 year age
            response.set_cookie(key=config.COOKIE_KEY, value=config.COOKIE_PASS, max_age=31536000)
            return response
        else:
            return render_template("login.html", base_url_path=config.BASE_URL_PATH)
    else:
        return render_template("login.html", base_url_path=config.BASE_URL_PATH)


if __name__ == "__main__":
    app.run(debug=config.DEBUG, host=config.HOST_IP)
