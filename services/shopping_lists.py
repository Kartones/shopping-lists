#!/usr/bin/python
# -!- coding: utf-8 -!-

import os
import re

from constants import (
  ACTION_CREATE, ACTION_UPDATE, ACTION_HIGHLIGHT, ACTION_DELETE, ITEM_STATUS_DEFAULT, ITEM_STATUS_ACTIVE,
  ITEM_STATUS_HIGHLIGHTED
)
from services.event_logger import EventLogger


class ShoppingLists():

    def __init__(self, config):
        self.config = config

    def is_multi_line_list(self, list_name):
        return list_name.startswith(self.config.MULTI_LINE_MODE_PREFIX)

    def unprefixed_list_name(self, list_name, is_multi_line):
        if is_multi_line:
            return list_name[len(self.config.MULTI_LINE_MODE_PREFIX):]
        return list_name

    def get_all_lists(self):
        folder_path = os.path.join(".", self.config.LISTS_FOLDER)
        files = self._get_txt_files_from_directory(folder_path)
        return [self._get_list_name(file) for file in sorted(files)]

    def get_all_folders(self):
        folder_path = os.path.join(".", self.config.LISTS_FOLDER)
        return sorted([
            name for name in os.listdir(folder_path)
            if os.path.isdir(os.path.join(folder_path, name)) and not name.endswith("_files")
        ])

    def get_lists_in_folder(self, folder_name):
        clean_folder = self._clean_folder_name(folder_name)
        folder_path = os.path.join(".", self.config.LISTS_FOLDER, clean_folder)
        if not os.path.isdir(folder_path):
            return []
        files = self._get_txt_files_from_directory(folder_path)
        return [self._get_list_name(file) for file in sorted(files)]

    def get_files_dir(self, list_name, folder_name=None):
        clean_name = self._clean_list_name(list_name)
        if folder_name:
            clean_folder = self._clean_folder_name(folder_name)
            return os.path.join(self.config.LISTS_FOLDER, clean_folder, "{}_files".format(clean_name))
        return os.path.join(self.config.LISTS_FOLDER, "{}_files".format(clean_name))

    def get_items(self, list_name, folder_name=None):
        file_path = self._get_file_path(list_name, folder_name)
        return self._load_list_items_from_file(file_path)

    def save_list_item_action(self, list_name, item_name, action, folder_name=None):
        file_path = self._get_file_path(list_name, folder_name)
        items = self._load_list_items_from_file(file_path)

        if action == ACTION_CREATE:
            items[item_name] = ITEM_STATUS_ACTIVE
        elif action == ACTION_UPDATE:
            items[item_name] = ITEM_STATUS_DEFAULT
        elif action == ACTION_HIGHLIGHT:
            items[item_name] = ITEM_STATUS_HIGHLIGHTED
        elif action == ACTION_DELETE:
            if item_name in items:
                del items[item_name]

        self._save_list(list_name, items, folder_name)

        EventLogger.log(list_name, item_name, action)

    def _save_list(self, list_name, list_items, folder_name=None):
        separator = self.config.SEPARATOR
        file_path = self._get_file_path(list_name, folder_name)
        if not os.path.exists(file_path):
            raise IOError("Invalid list")
        with open(file_path, "w") as file:
            file.write("\r\n".join(["{}{}{}".format(name, separator, state) for name, state in list_items.items()]))

    def _get_file_path(self, list_name, folder_name=None):
        clean_name = self._clean_list_name(list_name)
        if folder_name:
            clean_folder = self._clean_folder_name(folder_name)
            return os.path.join(".", self.config.LISTS_FOLDER, clean_folder, "{}.txt".format(clean_name))
        return os.path.join(".", self.config.LISTS_FOLDER, "{}.txt".format(clean_name))

    @staticmethod
    def _get_txt_files_from_directory(path):
        return [filename for filename in os.listdir(path) if filename.endswith(".txt")]

    @staticmethod
    def _get_list_name(filepath):
        return filepath.split(".")[0]

    def _load_list_items_from_file(self, filepath):
        separator = self.config.SEPARATOR

        with open(filepath, "r") as file:
            items = {line.split(separator)[0]: line.split(separator)[1].replace("\n", "") for line in file}
        return items

    @staticmethod
    def _clean_list_name(list_name):
        return re.sub(r"[\/\\\.]", "", list_name)

    @staticmethod
    def _clean_folder_name(folder_name):
        return re.sub(r"[\/\\\.\s]", "", folder_name)
