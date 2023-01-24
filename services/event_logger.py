
from datetime import datetime
import os

import config


class EventLogger():

    @staticmethod
    def log(list_name, item_name, action):
        timestamp = int(datetime.timestamp(datetime.now()))

        file_path = os.path.join(".", config.LISTS_FOLDER, config.EVENTS_FILENAME)
        with open(file_path, "a") as file:
            file.write(
                "{ts},{list},{item},{action}\r\n".format(ts=timestamp, list=list_name, item=item_name, action=action)
            )
