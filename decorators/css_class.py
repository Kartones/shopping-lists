

class CSSClassDecorator():

    @classmethod
    def decorate_items(cls, items_dict):
        data = []
        for item_name in sorted(items_dict.keys()):
            fragments = [item_name, items_dict[item_name]]
            fragments.append(cls._css_class_for_item(items_dict[item_name]))
            data.append(fragments)
        return data

    @staticmethod
    def _css_class_for_item(item_status):
        css_class = ""
        if item_status == "0":
            css_class = "btn-default"
        elif item_status == "1":
            css_class = "btn-warning"
        elif item_status == "2":
            css_class = "btn-danger"

        return css_class
